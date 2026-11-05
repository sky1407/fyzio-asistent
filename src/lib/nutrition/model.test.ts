import { describe, expect, it } from "vitest";
import type { Patient } from "@/lib/patients/model";
import { checkNutrition, estimateEnergyNeed, type Meal } from "./model";

const patient: Patient = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Jana",
  last_name: "Nováková",
  birth_year: 1986,
  sex: "F",
  height_cm: 168,
  weight_kg: 65,
  occupation: "",
  work_type: "sedava",
  activity_level: "stredna",
  diagnoses: "",
  limitations: "",
  goals: "",
  notes: "",
};

describe("estimateEnergyNeed", () => {
  it("computes Mifflin–St Jeor with activity factor", () => {
    const need = estimateEnergyNeed(patient, new Date("2026-01-01"));
    // BMR = 10*65 + 6.25*168 - 5*40 - 161 = 1339; ×1.45 ≈ 1942
    expect(need).not.toBeNull();
    expect(need!.bmr).toBe(1339);
    expect(need!.target).toBe(1942);
    expect(need!.min).toBeLessThan(need!.target);
    expect(need!.max).toBeGreaterThan(need!.target);
  });

  it("returns null when key data is missing", () => {
    expect(estimateEnergyNeed({ ...patient, weight_kg: null })).toBeNull();
    expect(estimateEnergyNeed({ ...patient, sex: null })).toBeNull();
  });
});

describe("checkNutrition", () => {
  const need = estimateEnergyNeed(patient, new Date("2026-01-01"));

  it("flags meals whose macros do not match their calories", () => {
    const meals: Meal[] = [{ name: "Obed", kcal: 600, protein_g: 10, carbs_g: 10, fat_g: 5 }];
    const result = checkNutrition(meals, need);
    expect(result.warnings.some((w) => w.includes("Obed"))).toBe(true);
  });

  it("flags totals outside the estimated need", () => {
    const meals: Meal[] = [{ name: "Deň", kcal: 900, protein_g: 50, carbs_g: 120, fat_g: 20 }];
    const result = checkNutrition(meals, need);
    expect(result.totalKcal).toBe(900);
    expect(result.warnings.some((w) => w.includes("pod odhadovanou potrebou"))).toBe(true);
  });

  it("stays silent for a consistent plan within range", () => {
    const meals: Meal[] = [
      { name: "Raňajky", kcal: 500, protein_g: 30, carbs_g: 60, fat_g: 15 },
      { name: "Obed", kcal: 700, protein_g: 45, carbs_g: 80, fat_g: 20 },
      { name: "Večera", kcal: 700, protein_g: 45, carbs_g: 75, fat_g: 23 },
    ];
    const result = checkNutrition(meals, need);
    expect(result.totalKcal).toBe(1900);
    expect(result.warnings).toEqual([]);
  });

  it("skips macro check when macros are not provided", () => {
    const meals: Meal[] = [{ name: "Obed", kcal: 600, protein_g: 0, carbs_g: 0, fat_g: 0 }];
    expect(checkNutrition(meals, null).warnings).toEqual([]);
  });
});
