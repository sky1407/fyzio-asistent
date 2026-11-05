"use server";

import * as z from "zod";
import { buildPatientContext } from "@/lib/ai/context";
import {
  MEAL_PLAN_RESPONSE_SCHEMA,
  MealPlanSchema,
  buildMealExtractionPrompt,
  normalizeMealPlan,
} from "@/lib/ai/meal-plan";
import { buildRedactor } from "@/lib/ai/redact";
import {
  REVIEW_RESPONSE_SCHEMA,
  ReviewSchema,
  buildReviewPrompt,
  normalizeReview,
  type Review,
} from "@/lib/ai/review";
import {
  AnswerSummarySchema,
  SUMMARY_RESPONSE_SCHEMA,
  buildSummaryPrompt,
  normalizeSummary,
  type AnswerSummary,
} from "@/lib/ai/summary";
import { checkNutrition, estimateEnergyNeed, type NutritionCheck } from "@/lib/nutrition/model";
import { requireSession } from "@/lib/server/auth";
import { AI_ERROR_RESPONSES, AiError } from "@/lib/server/ai-common";
import {
  deleteConversation,
  listConversations,
  listMessages,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/server/conversations";
import { generateJson } from "@/lib/server/llm";
import { getPatient } from "@/lib/server/patients";

const OptionalId = z.uuid().nullable();
const Id = z.uuid();
const AnswerText = z.string().trim().min(1).max(100_000);

const AI_ACTION_TIMEOUT_MS = 60_000;

export type SummaryResult = { ok: true; summary: AnswerSummary } | { ok: false; error: string };
export type NutritionResult = { ok: true; check: NutritionCheck } | { ok: false; error: string };
export type ReviewResult = { ok: true; review: Review } | { ok: false; error: string };

function aiError(error: unknown, context: string, fallback: string): { ok: false; error: string } {
  if (error instanceof AiError) {
    console.error(`${context}:`, error.message);
    return { ok: false, error: AI_ERROR_RESPONSES[error.kind].message };
  }
  console.error(`${context}:`, error);
  return { ok: false, error: fallback };
}

export async function loadConversations(patientId: string | null): Promise<ConversationSummary[]> {
  return listConversations(OptionalId.parse(patientId));
}

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  return listMessages(Id.parse(conversationId));
}

export async function removeConversation(conversationId: string): Promise<boolean> {
  return deleteConversation(Id.parse(conversationId));
}

export async function summarizeAnswer(patientId: string | null, answer: string): Promise<SummaryResult> {
  await requireSession();
  const text = AnswerText.safeParse(answer);
  if (!text.success) return { ok: false, error: "Prázdnu odpoveď nie je čo zhrnúť." };
  const id = OptionalId.parse(patientId);
  try {
    const patient = id ? await getPatient(id) : null;
    const redact = buildRedactor(patient ? [patient.first_name, patient.last_name] : []);
    const result = await generateJson(
      buildSummaryPrompt(text.data),
      SUMMARY_RESPONSE_SCHEMA,
      AnswerSummarySchema,
      AbortSignal.timeout(AI_ACTION_TIMEOUT_MS),
      redact,
    );
    return { ok: true, summary: normalizeSummary(result) };
  } catch (error) {
    return aiError(error, "Answer summary failed", "Zhrnutie sa nepodarilo vytvoriť. Skúste to znova.");
  }
}

export async function checkPlanNutrition(patientId: string | null, planContent: string): Promise<NutritionResult> {
  await requireSession();
  const text = AnswerText.safeParse(planContent);
  if (!text.success) return { ok: false, error: "Prázdny plán nie je čo overiť." };
  const id = OptionalId.parse(patientId);
  if (!id) return { ok: false, error: "Výživu viem overiť len pri vybranom pacientovi." };
  try {
    const patient = await getPatient(id);
    if (!patient) return { ok: false, error: "Pacient neexistuje." };
    const redact = buildRedactor([patient.first_name, patient.last_name]);
    const plan = await generateJson(
      buildMealExtractionPrompt(text.data),
      MEAL_PLAN_RESPONSE_SCHEMA,
      MealPlanSchema,
      AbortSignal.timeout(AI_ACTION_TIMEOUT_MS),
      redact,
    );
    const meals = normalizeMealPlan(plan);
    if (meals.length === 0) return { ok: false, error: "V odpovedi nie je jedálniček s číslami na overenie." };
    return { ok: true, check: checkNutrition(meals, estimateEnergyNeed(patient)) };
  } catch (error) {
    return aiError(error, "Nutrition check failed", "Výživu sa nepodarilo overiť. Skúste to znova.");
  }
}

export async function reviewAnswer(patientId: string | null, answer: string): Promise<ReviewResult> {
  await requireSession();
  const text = AnswerText.safeParse(answer);
  if (!text.success) return { ok: false, error: "Prázdnu odpoveď nie je čo skontrolovať." };
  const id = OptionalId.parse(patientId);
  if (!id) return { ok: false, error: "Kontrolu viem spraviť len pri vybranom pacientovi." };
  try {
    const patient = await getPatient(id);
    if (!patient) return { ok: false, error: "Pacient neexistuje." };
    const redact = buildRedactor([patient.first_name, patient.last_name]);
    const review = await generateJson(
      buildReviewPrompt(buildPatientContext(patient), text.data),
      REVIEW_RESPONSE_SCHEMA,
      ReviewSchema,
      AbortSignal.timeout(AI_ACTION_TIMEOUT_MS),
      redact,
      { preferFallback: true },
    );
    return { ok: true, review: normalizeReview(review) };
  } catch (error) {
    return aiError(error, "Answer review failed", "Kontrolu sa nepodarilo spraviť. Skúste to znova.");
  }
}
