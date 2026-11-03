import { describe, expect, it } from "vitest";
import { PatientInputSchema, ageFromBirthYear, bmi, bmiCategory } from "./model";

const valid = {
  first_name: " Jana ",
  last_name: "Nováková",
  birth_year: "1980",
  sex: "F",
  height_cm: "168",
  weight_kg: "72,5",
  occupation: "účtovníčka",
  work_type: "sedava",
  activity_level: "",
  diagnoses: "bolesti krížov",
  limitations: "",
  goals: "",
  notes: "",
};

describe("PatientInputSchema", () => {
  it("parses form strings, trims text and accepts a decimal comma", () => {
    const result = PatientInputSchema.parse(valid);
    expect(result.first_name).toBe("Jana");
    expect(result.birth_year).toBe(1980);
    expect(result.weight_kg).toBe(72.5);
    expect(result.activity_level).toBeNull();
  });

  it("turns empty optional fields into null", () => {
    const result = PatientInputSchema.parse({ first_name: "A", last_name: "B", birth_year: "", height_cm: " " });
    expect(result.birth_year).toBeNull();
    expect(result.height_cm).toBeNull();
    expect(result.diagnoses).toBe("");
  });

  it("rejects missing names, out-of-range numbers and unknown choices", () => {
    const result = PatientInputSchema.safeParse({
      ...valid,
      first_name: "  ",
      height_cm: "300",
      weight_kg: "abc",
      birth_year: "1980.5",
      work_type: "astronaut",
    });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["first_name", "height_cm", "weight_kg", "birth_year", "work_type"]));
  });
});

describe("helpers", () => {
  it("computes age from the birth year", () => {
    expect(ageFromBirthYear(1980, new Date("2026-11-03"))).toBe(46);
    expect(ageFromBirthYear(null)).toBeNull();
    expect(ageFromBirthYear(2100, new Date("2026-11-03"))).toBeNull();
  });

  it("computes BMI and its category", () => {
    expect(bmi(168, 72.5)).toBe(25.7);
    expect(bmi(null, 70)).toBeNull();
    expect(bmiCategory(25.7)).toBe("nadváha");
    expect(bmiCategory(17)).toBe("podváha");
    expect(bmiCategory(22)).toBe("norma");
    expect(bmiCategory(31)).toBe("obezita");
  });
});
