import * as z from "zod";

export const SEXES = { F: "Žena", M: "Muž" } as const;

export const WORK_TYPES = {
  sedava: "Sedavá (kancelária, počítač, šoférovanie)",
  stojaca: "Stojaca (predaj, výroba, kaderníctvo)",
  manualna_lahka: "Ľahká manuálna (upratovanie, opatrovanie)",
  manualna_tazka: "Ťažká manuálna (stavba, sklad, záhrada)",
  zmiesana: "Zmiešaná",
} as const;

export const ACTIVITY_LEVELS = {
  nizka: "Nízka (takmer bez pohybu)",
  stredna: "Stredná (pohyb 1–3× týždenne)",
  vysoka: "Vysoká (šport 4× a viac týždenne)",
} as const;

export type Sex = keyof typeof SEXES;
export type WorkType = keyof typeof WORK_TYPES;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;

function keysOf<T extends Record<string, string>>(values: T): [keyof T & string, ...(keyof T & string)[]] {
  return Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];
}

const emptyToNull = (value: unknown): unknown => (value === "" || value === undefined ? null : value);

function optionalChoice<T extends Record<string, string>>(values: T) {
  return z.preprocess(emptyToNull, z.enum(keysOf(values), { error: "Neplatná voľba." }).nullable());
}

function optionalNumber(min: number, max: number, message: string, integer = false) {
  const base = integer ? z.number({ error: message }).int({ error: message }) : z.number({ error: message });
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return emptyToNull(value);
      const trimmed = value.trim().replace(",", ".");
      return trimmed === "" ? null : Number(trimmed);
    },
    base.min(min, { error: message }).max(max, { error: message }).nullable(),
  );
}

function text(max: number) {
  return z.preprocess((value) => value ?? "", z.string().trim().max(max, { error: `Maximálne ${max} znakov.` }));
}

export const PatientInputSchema = z.object({
  first_name: z.string().trim().min(1, { error: "Zadajte meno." }).max(100),
  last_name: z.string().trim().min(1, { error: "Zadajte priezvisko." }).max(100),
  birth_year: optionalNumber(1900, 2100, "Zadajte rok narodenia, napr. 1980.", true),
  sex: optionalChoice(SEXES),
  height_cm: optionalNumber(50, 250, "Výška musí byť medzi 50 a 250 cm."),
  weight_kg: optionalNumber(10, 400, "Váha musí byť medzi 10 a 400 kg."),
  occupation: text(200),
  work_type: optionalChoice(WORK_TYPES),
  activity_level: optionalChoice(ACTIVITY_LEVELS),
  diagnoses: text(4000),
  limitations: text(4000),
  goals: text(4000),
  notes: text(4000),
});

export type PatientInput = z.infer<typeof PatientInputSchema>;

export const PatientSchema = PatientInputSchema.extend({ id: z.uuid() });

export type Patient = z.infer<typeof PatientSchema>;

export const PATIENT_FIELDS = Object.keys(PatientInputSchema.shape) as (keyof PatientInput)[];

export function ageFromBirthYear(birthYear: number | null, now: Date = new Date()): number | null {
  if (birthYear === null) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 0 && age <= 130 ? age : null;
}

export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function bmiCategory(value: number | null): string | null {
  if (value === null) return null;
  if (value < 18.5) return "podváha";
  if (value < 25) return "norma";
  if (value < 30) return "nadváha";
  return "obezita";
}
