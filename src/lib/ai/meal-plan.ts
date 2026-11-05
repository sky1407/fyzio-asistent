import * as z from "zod";
import type { Meal } from "@/lib/nutrition/model";

export const MAX_MEALS = 12;

export const MealPlanSchema = z.object({
  meals: z.array(
    z.object({
      name: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    }),
  ),
});

export type MealPlan = z.infer<typeof MealPlanSchema>;

export const MEAL_PLAN_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    meals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Názov jedla (napr. Raňajky, Obed, Olovrant)." },
          kcal: { type: "NUMBER", description: "Energetická hodnota jedla v kcal. Ak nie je uvedená, daj 0." },
          protein_g: { type: "NUMBER", description: "Bielkoviny v gramoch. Ak nie sú uvedené, daj 0." },
          carbs_g: { type: "NUMBER", description: "Sacharidy v gramoch. Ak nie sú uvedené, daj 0." },
          fat_g: { type: "NUMBER", description: "Tuky v gramoch. Ak nie sú uvedené, daj 0." },
        },
        required: ["name", "kcal", "protein_g", "carbs_g", "fat_g"],
      },
    },
  },
  required: ["meals"],
} as const;

export function buildMealExtractionPrompt(planContent: string): string {
  return `Z nasledujúceho jedálnička vytiahni jednotlivé jedlá a ich výživové hodnoty.

Pravidlá:
- Vychádzaj iba z textu. Čísla neodhaduj ani nedopĺňaj z vlastných vedomostí.
- Ak jedlo nemá uvedenú niektorú hodnotu (kcal alebo makroživinu), daj pre ňu 0.
- name: krátky názov jedla (Raňajky, Desiata, Obed, Olovrant, Večera).
- Každé jedlo uveď iba raz.
- Ak text neobsahuje žiadny jedálniček s číslami, vráť prázdne pole.

JEDÁLNIČEK:
<<<
${planContent}
>>>`;
}

function toNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

export function normalizeMealPlan(plan: MealPlan): Meal[] {
  return plan.meals.slice(0, MAX_MEALS).map((meal) => ({
    name: meal.name.replace(/\s+/g, " ").trim().slice(0, 100) || "Jedlo",
    kcal: toNonNegative(meal.kcal),
    protein_g: toNonNegative(meal.protein_g),
    carbs_g: toNonNegative(meal.carbs_g),
    fat_g: toNonNegative(meal.fat_g),
  }));
}
