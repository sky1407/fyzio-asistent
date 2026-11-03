"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Exercise, ExerciseInput } from "@/lib/exercises/model";
import type { ExerciseFormState } from "./actions";

type Props = {
  action: (state: ExerciseFormState, formData: FormData) => Promise<ExerciseFormState>;
  exercise?: Exercise;
  submitLabel: string;
};

const FIELDS: {
  name: keyof ExerciseInput;
  label: string;
  hint?: string;
  multiline?: boolean;
  type?: "url";
}[] = [
  { name: "name", label: "Názov cviku *" },
  { name: "target", label: "Na čo je cvik zameraný", hint: "napr. uvoľnenie krčnej chrbtice, posilnenie sedacích svalov" },
  { name: "description", label: "Popis vykonania", hint: "Východisková poloha, pohyb, dýchanie, na čo si dať pozor.", multiline: true },
  {
    name: "video_url",
    label: "Odkaz na video",
    hint: "Nepovinné. Ak ho nevyplníte, pri cviku sa zobrazí vyhľadávanie na YouTube.",
    type: "url",
  },
];

export function ExerciseForm({ action, exercise, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state?.message && (
        <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.message}
        </p>
      )}
      <div className="card grid gap-4">
        {FIELDS.map((field) => {
          const error = state?.errors?.[field.name];
          const defaultValue = state?.values[field.name] ?? exercise?.[field.name] ?? "";
          const describedBy = [field.hint ? `${field.name}-hint` : null, error ? `${field.name}-error` : null]
            .filter(Boolean)
            .join(" ");
          const shared = {
            id: field.name,
            name: field.name,
            defaultValue,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy || undefined,
          };
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              {field.multiline ? (
                <textarea {...shared} rows={5} className="field-input resize-y" />
              ) : (
                <input {...shared} type={field.type === "url" ? "url" : "text"} inputMode={field.type} autoComplete="off" className="field-input" />
              )}
              {field.hint && (
                <p id={`${field.name}-hint`} className="mt-1 text-xs text-slate-500">
                  {field.hint}
                </p>
              )}
              {error && (
                <p id={`${field.name}-error`} className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/cviky" className="btn-secondary">
          Zrušiť
        </Link>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Ukladám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
