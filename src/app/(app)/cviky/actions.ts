"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EXERCISE_FIELDS, ExerciseInputSchema, type ExerciseInput } from "@/lib/exercises/model";
import { requireSession } from "@/lib/server/auth";
import { createExercise, deleteExercise, updateExercise, type SaveExerciseResult } from "@/lib/server/exercises";

export type ExerciseFormState =
  | {
      message: string;
      errors?: Partial<Record<keyof ExerciseInput, string>>;
      values: Record<string, string>;
    }
  | undefined;

async function saveExercise(
  formData: FormData,
  persist: (input: ExerciseInput) => Promise<SaveExerciseResult>,
): Promise<ExerciseFormState> {
  await requireSession();
  const values = Object.fromEntries(
    EXERCISE_FIELDS.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  );
  const parsed = ExerciseInputSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<keyof ExerciseInput, string>> = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as keyof ExerciseInput] ??= issue.message;
    return { message: "Skontrolujte zvýraznené polia.", errors, values };
  }

  let result: SaveExerciseResult;
  try {
    result = await persist(parsed.data);
  } catch (error) {
    console.error("Saving exercise failed:", error);
    return { message: "Cvik sa nepodarilo uložiť. Skúste to znova.", values };
  }
  if (result.status === "duplicate") {
    return {
      message: "Cvik s týmto názvom už v knižnici je.",
      errors: { name: "Zvoľte iný názov alebo upravte existujúci cvik." },
      values,
    };
  }
  if (result.status === "not_found") return { message: "Cvik už neexistuje.", values };
  revalidatePath("/", "layout");
  redirect("/cviky");
}

export async function createExerciseAction(_previous: ExerciseFormState, formData: FormData): Promise<ExerciseFormState> {
  return saveExercise(formData, createExercise);
}

export async function updateExerciseAction(
  id: string,
  _previous: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  return saveExercise(formData, (input) => updateExercise(id, input));
}

export async function deleteExerciseAction(id: string): Promise<void> {
  await requireSession();
  try {
    await deleteExercise(id);
  } catch (error) {
    console.error("Deleting exercise failed:", error);
    throw new Error("Cvik sa nepodarilo vymazať.");
  }
  revalidatePath("/", "layout");
  redirect("/cviky");
}
