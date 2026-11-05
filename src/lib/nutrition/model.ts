import { ageFromBirthYear, type ActivityLevel, type Patient, type WorkType } from "@/lib/patients/model";

export type Meal = {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type EnergyNeed = { bmr: number; target: number; min: number; max: number };

export type NutritionCheck = {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  need: EnergyNeed | null;
  warnings: string[];
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { nizka: 1.3, stredna: 1.45, vysoka: 1.6 };
const WORK_BONUS: Record<WorkType, number> = {
  sedava: 0,
  stojaca: 0.05,
  manualna_lahka: 0.05,
  manualna_tazka: 0.15,
  zmiesana: 0.05,
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
const TARGET_BAND = 0.1;

/** Mifflin–St Jeor BMR adjusted by activity level and work load; null if key data is missing. */
export function estimateEnergyNeed(patient: Patient, now: Date = new Date()): EnergyNeed | null {
  const age = ageFromBirthYear(patient.birth_year, now);
  if (!patient.weight_kg || !patient.height_cm || age === null || !patient.sex) return null;

  const base = 10 * patient.weight_kg + 6.25 * patient.height_cm - 5 * age;
  const bmr = Math.round(base + (patient.sex === "M" ? 5 : -161));
  const factor = (patient.activity_level ? ACTIVITY_FACTOR[patient.activity_level] : 1.4) +
    (patient.work_type ? WORK_BONUS[patient.work_type] : 0);
  const target = Math.round(bmr * factor);
  return { bmr, target, min: Math.round(target * (1 - TARGET_BAND)), max: Math.round(target * (1 + TARGET_BAND)) };
}

function macroKcal(meal: Meal): number {
  return meal.protein_g * KCAL_PER_G.protein + meal.carbs_g * KCAL_PER_G.carbs + meal.fat_g * KCAL_PER_G.fat;
}

export function checkNutrition(meals: Meal[], need: EnergyNeed | null): NutritionCheck {
  const totals = meals.reduce(
    (acc, meal) => ({
      totalKcal: acc.totalKcal + meal.kcal,
      totalProtein: acc.totalProtein + meal.protein_g,
      totalCarbs: acc.totalCarbs + meal.carbs_g,
      totalFat: acc.totalFat + meal.fat_g,
    }),
    { totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 },
  );

  const warnings: string[] = [];
  for (const meal of meals) {
    if (meal.kcal <= 0 || macroKcal(meal) <= 0) continue;
    const expected = macroKcal(meal);
    const tolerance = Math.max(50, meal.kcal * 0.15);
    if (Math.abs(expected - meal.kcal) > tolerance) {
      warnings.push(
        `„${meal.name}": zadané ${meal.kcal} kcal, ale z makroživín vychádza ${Math.round(expected)} kcal.`,
      );
    }
  }

  if (need && totals.totalKcal > 0) {
    if (totals.totalKcal < need.min) {
      warnings.push(`Súčet ${totals.totalKcal} kcal je pod odhadovanou potrebou ${need.min}–${need.max} kcal.`);
    } else if (totals.totalKcal > need.max) {
      warnings.push(`Súčet ${totals.totalKcal} kcal je nad odhadovanou potrebou ${need.min}–${need.max} kcal.`);
    }
  }

  return { ...totals, need, warnings };
}
