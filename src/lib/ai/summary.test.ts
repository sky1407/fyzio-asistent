import { describe, expect, it } from "vitest";
import {
  MAX_ITEMS,
  buildSummaryPrompt,
  isSummaryEmpty,
  normalizeSummary,
  type AnswerSummary,
} from "./summary";

describe("buildSummaryPrompt", () => {
  it("embeds the answer and forbids inventing content", () => {
    const prompt = buildSummaryPrompt("Odporúčam mostík a plank.");
    expect(prompt).toContain("Odporúčam mostík a plank.");
    expect(prompt).toContain("Nič nevymýšľaj");
  });
});

describe("normalizeSummary", () => {
  it("trims, de-duplicates and caps list items", () => {
    const raw: AnswerSummary = {
      hlavny_problem: "  Bolesť krížov  ",
      odporucane_cviky: ["Plank", "plank", "  Mostík ", ...Array.from({ length: 20 }, (_, i) => `Cvik ${i}`)],
      kontraindikacie: ["", "Žiadne skoky"],
      red_flags: [],
    };
    const summary = normalizeSummary(raw);
    expect(summary.hlavny_problem).toBe("Bolesť krížov");
    expect(summary.odporucane_cviky.length).toBe(MAX_ITEMS);
    expect(summary.odporucane_cviky.slice(0, 2)).toEqual(["Plank", "Mostík"]);
    expect(summary.kontraindikacie).toEqual(["Žiadne skoky"]);
  });
});

describe("isSummaryEmpty", () => {
  it("detects a fully empty summary", () => {
    expect(isSummaryEmpty({ hlavny_problem: "", odporucane_cviky: [], kontraindikacie: [], red_flags: [] })).toBe(true);
    expect(
      isSummaryEmpty({ hlavny_problem: "", odporucane_cviky: ["Plank"], kontraindikacie: [], red_flags: [] }),
    ).toBe(false);
  });
});
