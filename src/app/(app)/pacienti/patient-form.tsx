"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { ACTIVITY_LEVELS, SEXES, WORK_TYPES, type Patient, type PatientInput } from "@/lib/patients/model";
import type { PatientFormState } from "./actions";

type FieldName = keyof PatientInput;

type Props = {
  action: (state: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  patient?: Patient;
  submitLabel: string;
  cancelHref: string;
};

type ControlProps = {
  id: string;
  name: FieldName;
  defaultValue: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FieldProps = {
  name: FieldName;
  label: string;
  value: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  render: (props: ControlProps) => ReactNode;
};

function toFormValue(value: Patient[FieldName] | undefined): string {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? String(value).replace(".", ",") : value;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card grid gap-4 sm:grid-cols-2">
      <legend className="float-left mb-1 w-full text-base font-semibold text-teal-800 sm:col-span-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ name, label, value, error, hint, wide, render }: FieldProps) {
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {render({
        id: name,
        name,
        defaultValue: value,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function textInput(extra: { inputMode?: "numeric" | "decimal"; placeholder?: string } = {}) {
  return function TextInput(props: ControlProps) {
    return <input {...props} {...extra} autoComplete="off" className="field-input" />;
  };
}

function choice(options: Record<string, string>) {
  return function Choice(props: ControlProps) {
    return (
      <select {...props} className="field-input">
        <option value="">— nevybrané —</option>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    );
  };
}

function LongText(props: ControlProps) {
  return <textarea {...props} rows={3} className="field-input resize-y" />;
}

const PlainInput = textInput();
const YearInput = textInput({ inputMode: "numeric", placeholder: "napr. 1980" });
const DecimalInput = textInput({ inputMode: "decimal" });
const SexChoice = choice(SEXES);
const WorkTypeChoice = choice(WORK_TYPES);
const ActivityChoice = choice(ACTIVITY_LEVELS);

export function PatientForm({ action, patient, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const field = (name: FieldName) => ({
    name,
    value: state?.values[name] ?? toFormValue(patient?.[name]),
    error: state?.errors?.[name],
  });

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state?.message && (
        <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.message}
        </p>
      )}

      <Section title="Základné údaje">
        <Field {...field("first_name")} label="Meno *" render={PlainInput} />
        <Field {...field("last_name")} label="Priezvisko *" render={PlainInput} />
        <Field {...field("birth_year")} label="Rok narodenia" render={YearInput} />
        <Field {...field("sex")} label="Pohlavie" render={SexChoice} />
        <Field {...field("height_cm")} label="Výška (cm)" render={DecimalInput} />
        <Field {...field("weight_kg")} label="Váha (kg)" render={DecimalInput} />
      </Section>

      <Section title="Práca a pohyb">
        <Field
          {...field("occupation")}
          label="Zamestnanie"
          hint="napr. účtovníčka, murár, vodič kamiónu"
          render={PlainInput}
        />
        <Field {...field("work_type")} label="Typ pracovnej záťaže" render={WorkTypeChoice} />
        <Field {...field("activity_level")} label="Pohybová aktivita mimo práce" render={ActivityChoice} />
      </Section>

      <Section title="Zdravotný stav">
        <Field
          {...field("diagnoses")}
          label="Diagnózy"
          hint="Napr. lumbago, stav po operácii kolena (2024), artróza bedra."
          wide
          render={LongText}
        />
        <Field
          {...field("limitations")}
          label="Obmedzenia a kontraindikácie"
          hint="Čomu sa vyhnúť: skoky, záťaž nad hlavou, predklony…"
          wide
          render={LongText}
        />
        <Field
          {...field("goals")}
          label="Ciele pacienta"
          hint="Napr. zbaviť sa bolesti chrbta, vrátiť sa k behu."
          wide
          render={LongText}
        />
        <Field {...field("notes")} label="Poznámky" wide render={LongText} />
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="btn-secondary">
          Zrušiť
        </Link>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Ukladám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
