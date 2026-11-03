import * as z from "zod";

export const PLAN_TITLE_MAX = 200;
export const PLAN_CONTENT_MAX = 100_000;

export const PlanInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Zadajte názov plánu." })
    .max(PLAN_TITLE_MAX, { error: `Názov môže mať najviac ${PLAN_TITLE_MAX} znakov.` }),
  content: z
    .string()
    .trim()
    .min(1, { error: "Plán nemôže byť prázdny." })
    .max(PLAN_CONTENT_MAX, { error: "Plán je príliš dlhý." }),
});

export type PlanInput = z.infer<typeof PlanInputSchema>;

export function defaultPlanTitle(source: string, now: Date = new Date()): string {
  const date = now.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });
  const base = source.replace(/\s+/g, " ").trim() || "Plán";
  const shortened = base.length > 60 ? `${base.slice(0, 57)}…` : base;
  return `${shortened} – ${date}`;
}
