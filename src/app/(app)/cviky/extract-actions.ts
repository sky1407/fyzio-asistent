"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import {
  EXTRACTION_RESPONSE_SCHEMA,
  ExtractionResultSchema,
  MAX_EXTRACTED,
  buildExtractionPrompt,
  normalizeExtracted,
} from "@/lib/ai/extract";
import { buildRedactor } from "@/lib/ai/redact";
import { ExerciseInputSchema, exerciseKey, type ExerciseInput } from "@/lib/exercises/model";
import { requireSession } from "@/lib/server/auth";
import { addExercises, listExerciseKeys } from "@/lib/server/exercises";
import { AI_ERROR_RESPONSES, AiError } from "@/lib/server/ai-common";
import { generateJson } from "@/lib/server/llm";
import { getPatient } from "@/lib/server/patients";
import { getPlan } from "@/lib/server/plans";

const EXTRACTION_TIMEOUT_MS = 90_000;

export type ExerciseCandidate = ExerciseInput & { exists: boolean };

export type ExtractResult = { ok: true; candidates: ExerciseCandidate[] } | { ok: false; error: string };

export type AddResult = { ok: true; added: number } | { ok: false; error: string };

export async function extractExercisesFromPlan(patientId: string, planId: string): Promise<ExtractResult> {
  await requireSession();
  try {
    const [plan, patient] = await Promise.all([getPlan(patientId, planId), getPatient(patientId)]);
    if (!plan) return { ok: false, error: "Plán neexistuje." };

    const redact = buildRedactor(patient ? [patient.first_name, patient.last_name] : []);
    const result = await generateJson(
      buildExtractionPrompt(plan.content),
      EXTRACTION_RESPONSE_SCHEMA,
      ExtractionResultSchema,
      AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
      redact,
    );
    const exercises = normalizeExtracted(result);
    const existing = await listExerciseKeys();
    return {
      ok: true,
      candidates: exercises.map((exercise) => ({ ...exercise, exists: existing.has(exerciseKey(exercise.name)) })),
    };
  } catch (error) {
    if (error instanceof AiError) {
      console.error("Exercise extraction failed:", error.message);
      return { ok: false, error: AI_ERROR_RESPONSES[error.kind].message };
    }
    console.error("Exercise extraction failed:", error);
    return { ok: false, error: "Cviky sa nepodarilo vytiahnuť. Skúste to znova." };
  }
}

export async function addExtractedExercises(items: ExerciseInput[]): Promise<AddResult> {
  await requireSession();
  const parsed = z.array(ExerciseInputSchema).min(1).max(MAX_EXTRACTED).safeParse(items);
  if (!parsed.success) return { ok: false, error: "Vyberte aspoň jeden platný cvik." };
  try {
    const added = await addExercises(parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, added };
  } catch (error) {
    console.error("Adding exercises failed:", error);
    return { ok: false, error: "Cviky sa nepodarilo uložiť. Skúste to znova." };
  }
}
