"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { PlanInputSchema, type PlanInput } from "@/lib/plans/model";
import { requireSession } from "@/lib/server/auth";
import { createPlan, deletePlan, updatePlan } from "@/lib/server/plans";

export type SavePlanResult = { ok: true; planId: string } | { ok: false; error: string };

export type PlanFormState =
  | {
      message: string;
      errors?: Partial<Record<keyof PlanInput, string>>;
      values: Record<keyof PlanInput, string>;
    }
  | undefined;

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export async function savePlanFromChat(patientId: string, title: string, content: string): Promise<SavePlanResult> {
  await requireSession();
  if (!isUuid(patientId)) return { ok: false, error: "Neplatný pacient." };
  const parsed = PlanInputSchema.safeParse({ title, content });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neplatný plán." };

  try {
    const planId = await createPlan(patientId, parsed.data);
    if (!planId) return { ok: false, error: "Pacient už neexistuje." };
    revalidatePath("/", "layout");
    return { ok: true, planId };
  } catch (error) {
    console.error("Saving plan failed:", error);
    return { ok: false, error: "Plán sa nepodarilo uložiť. Skúste to znova." };
  }
}

export async function updatePlanAction(
  patientId: string,
  planId: string,
  _previous: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  await requireSession();
  const values = {
    title: typeof formData.get("title") === "string" ? String(formData.get("title")) : "",
    content: typeof formData.get("content") === "string" ? String(formData.get("content")) : "",
  };
  const parsed = PlanInputSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<keyof PlanInput, string>> = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as keyof PlanInput] ??= issue.message;
    return { message: "Skontrolujte zvýraznené polia.", errors, values };
  }

  let updated: boolean;
  try {
    updated = await updatePlan(patientId, planId, parsed.data);
  } catch (error) {
    console.error("Updating plan failed:", error);
    return { message: "Plán sa nepodarilo uložiť. Skúste to znova.", values };
  }
  if (!updated) return { message: "Plán už neexistuje.", values };
  revalidatePath("/", "layout");
  redirect(`/pacienti/${patientId}/plany/${planId}`);
}

export async function deletePlanAction(patientId: string, planId: string): Promise<void> {
  await requireSession();
  try {
    await deletePlan(patientId, planId);
  } catch (error) {
    console.error("Deleting plan failed:", error);
    throw new Error("Plán sa nepodarilo vymazať.");
  }
  revalidatePath("/", "layout");
  redirect(`/pacienti/${patientId}`);
}
