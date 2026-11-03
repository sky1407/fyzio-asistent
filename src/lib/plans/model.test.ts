import { describe, expect, it } from "vitest";
import { PlanInputSchema, defaultPlanTitle } from "./model";

describe("PlanInputSchema", () => {
  it("trims and accepts a valid plan", () => {
    expect(PlanInputSchema.parse({ title: "  Rehabilitácia ", content: " ## Fáza 1 " })).toEqual({
      title: "Rehabilitácia",
      content: "## Fáza 1",
    });
  });

  it("rejects an empty title and content", () => {
    const result = PlanInputSchema.safeParse({ title: " ", content: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["title", "content"]);
  });
});

describe("defaultPlanTitle", () => {
  const now = new Date("2026-11-03T12:00:00");

  it("appends the date to the source label", () => {
    expect(defaultPlanTitle("Rehabilitačný plán", now)).toMatch(/^Rehabilitačný plán – 3\. ?11\. ?2026$/);
  });

  it("shortens long questions and falls back to a generic name", () => {
    expect(defaultPlanTitle("a".repeat(100), now).startsWith(`${"a".repeat(57)}…`)).toBe(true);
    expect(defaultPlanTitle("   ", now).startsWith("Plán – ")).toBe(true);
  });
});
