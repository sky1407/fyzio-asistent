import { describe, expect, it } from "vitest";
import type { Patient } from "@/lib/patients/model";
import { LIBRARY_LIMIT, buildLibraryContext, buildPatientContext, buildSystemInstruction } from "./context";

const patient: Patient = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Jana",
  last_name: "Nováková",
  birth_year: 1980,
  sex: "F",
  height_cm: 168,
  weight_kg: 72.5,
  occupation: "účtovníčka",
  work_type: "sedava",
  activity_level: "nizka",
  diagnoses: "Lumbago\nbolesti krčnej chrbtice",
  limitations: "vyhnúť sa skokom",
  goals: "",
  notes: "",
};

describe("buildPatientContext", () => {
  const context = buildPatientContext(patient, new Date("2026-11-03"));

  it("never contains the patient's name or id", () => {
    expect(context).not.toContain("Jana");
    expect(context).not.toContain("Nováková");
    expect(context).not.toContain(patient.id);
  });

  it("includes the clinically relevant data", () => {
    expect(context).toContain("- Vek: 46 rokov");
    expect(context).toContain("- BMI: 25.7 (nadváha)");
    expect(context).toContain("Sedavá");
    expect(context).toContain("  Lumbago\n  bolesti krčnej chrbtice");
    expect(context).toContain("vyhnúť sa skokom");
  });

  it("omits empty fields", () => {
    expect(context).not.toContain("Ciele");
    expect(context).not.toContain("Poznámky");
  });

  it("handles a patient without any data", () => {
    const empty = buildPatientContext({
      ...patient,
      birth_year: null,
      sex: null,
      height_cm: null,
      weight_kg: null,
      occupation: "",
      work_type: null,
      activity_level: null,
      diagnoses: "",
      limitations: "",
    });
    expect(empty).toContain("nie sú vyplnené žiadne údaje");
  });
});

describe("buildSystemInstruction", () => {
  it("adds a general note when no patient is selected", () => {
    expect(buildSystemInstruction(null)).toContain("nie je viazaný na konkrétneho pacienta");
  });

  it("lists library exercises and omits the section when the library is empty", () => {
    const withLibrary = buildSystemInstruction(patient, [
      { name: "Mostík", target: "sedacie svaly" },
      { name: "Plank", target: "" },
    ]);
    expect(withLibrary).toContain("## Knižnica cvikov terapeutky");
    expect(withLibrary).toContain("- Mostík – sedacie svaly");
    expect(withLibrary.endsWith("- Plank")).toBe(true);
    expect(buildSystemInstruction(patient, [])).not.toContain("Knižnica cvikov");
  });

  it("limits the number of library exercises", () => {
    const library = Array.from({ length: LIBRARY_LIMIT + 20 }, (_, index) => ({ name: `Cvik ${index}`, target: "" }));
    const lines = (buildLibraryContext(library) ?? "").split("\n").filter((line) => line.startsWith("- "));
    expect(lines).toHaveLength(LIBRARY_LIMIT);
  });
});
