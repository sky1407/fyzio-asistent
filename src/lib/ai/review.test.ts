import { describe, expect, it } from "vitest";
import { MAX_FINDINGS, buildReviewPrompt, normalizeReview, type Review } from "./review";

describe("buildReviewPrompt", () => {
  it("includes the patient context and the answer under review", () => {
    const prompt = buildReviewPrompt("## Profil pacienta\n- Vek: 70 rokov", "Navrhujem mŕtvy ťah.");
    expect(prompt).toContain("Vek: 70 rokov");
    expect(prompt).toContain("Navrhujem mŕtvy ťah.");
    expect(prompt).toContain("nezávislý odborný recenzent");
  });
});

describe("normalizeReview", () => {
  it("drops empty findings and caps the list", () => {
    const raw: Review = {
      verdikt: "na_zvazenie",
      zistenia: [
        { zavaznost: "vysoka", problem: "  ", odporucanie: "x" },
        ...Array.from({ length: 15 }, (_, i) => ({
          zavaznost: "stredna" as const,
          problem: `Problém ${i}`,
          odporucanie: `Rada ${i}`,
        })),
      ],
    };
    const review = normalizeReview(raw);
    expect(review.zistenia.length).toBe(MAX_FINDINGS);
    expect(review.zistenia.every((f) => f.problem.trim())).toBe(true);
  });

  it("forces verdict to v_poriadku when nothing remains", () => {
    const review = normalizeReview({ verdikt: "na_zvazenie", zistenia: [] });
    expect(review.verdikt).toBe("v_poriadku");
  });
});
