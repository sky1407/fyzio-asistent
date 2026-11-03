"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type * as z from "zod";
import { PATIENT_FIELDS, PatientInputSchema, type PatientInput } from "@/lib/patients/model";
import { requireSession } from "@/lib/server/auth";
import { createPatient, deletePatient, updatePatient } from "@/lib/server/patients";

export type PatientFormState =
  | {
      message: string;
      errors?: Partial<Record<keyof PatientInput, string>>;
      values: Record<string, string>;
    }
  | undefined;

function readForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    PATIENT_FIELDS.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  );
}

function fieldErrors(error: z.ZodError): Partial<Record<keyof PatientInput, string>> {
  const errors: Partial<Record<keyof PatientInput, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof PatientInput;
    errors[field] ??= issue.message;
  }
  return errors;
}

async function savePatient(
  formData: FormData,
  persist: (input: PatientInput) => Promise<string | null>,
): Promise<PatientFormState> {
  await requireSession();
  const values = readForm(formData);
  const parsed = PatientInputSchema.safeParse(values);
  if (!parsed.success) {
    return { message: "Skontrolujte zvýraznené polia.", errors: fieldErrors(parsed.error), values };
  }

  let id: string | null;
  try {
    id = await persist(parsed.data);
  } catch (error) {
    console.error("Saving patient failed:", error);
    return { message: "Pacienta sa nepodarilo uložiť. Skúste to znova.", values };
  }
  if (!id) return { message: "Pacient už neexistuje.", values };
  revalidatePath("/", "layout");
  redirect(`/pacienti/${id}`);
}

export async function createPatientAction(_previous: PatientFormState, formData: FormData): Promise<PatientFormState> {
  return savePatient(formData, createPatient);
}

export async function updatePatientAction(
  id: string,
  _previous: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  return savePatient(formData, async (input) => ((await updatePatient(id, input)) ? id : null));
}

export async function deletePatientAction(id: string): Promise<void> {
  await requireSession();
  try {
    await deletePatient(id);
  } catch (error) {
    console.error("Deleting patient failed:", error);
    throw new Error("Pacienta sa nepodarilo vymazať.");
  }
  revalidatePath("/", "layout");
  redirect("/");
}
