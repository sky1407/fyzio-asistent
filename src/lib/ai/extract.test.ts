import { describe, expect, it } from "vitest";
import { MAX_EXTRACTED, buildExtractionPrompt, normalizeExtracted } from "./extract";

describe("normalizeExtracted", () => {
  it("trims, strips numbering and removes duplicates case-insensitively", () => {
    const result = normalizeExtracted({
      exercises: [
        { name: " 1. Mostík ", target: " sedacie  svaly ", description: "Ľah na chrbte.\n Dvíhať panvu." },
        { name: "mostík", target: "", description: "" },
        { name: "2) Mačací chrbát", target: "mobilita", description: "" },
        { name: "   ", target: "x", description: "y" },
      ],
    });
    expect(result).toEqual([
      { name: "Mostík", target: "sedacie svaly", description: "Ľah na chrbte. Dvíhať panvu.", video_url: "" },
      { name: "Mačací chrbát", target: "mobilita", description: "", video_url: "" },
    ]);
  });

  it("caps the number of exercises and the field lengths", () => {
    const many = Array.from({ length: 50 }, (_, index) => ({
      name: `Cvik ${index}`,
      target: "t".repeat(400),
      description: "",
    }));
    const result = normalizeExtracted({ exercises: many });
    expect(result).toHaveLength(MAX_EXTRACTED);
    expect(result[0].target.length).toBe(300);
  });
});

describe("buildExtractionPrompt", () => {
  it("wraps the plan content in delimiters", () => {
    expect(buildExtractionPrompt("## Plán")).toContain("<<<\n## Plán\n>>>");
  });
});
