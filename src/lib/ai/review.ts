import * as z from "zod";

export const MAX_FINDINGS = 10;
export const SEVERITIES = ["vysoka", "stredna", "nizka"] as const;

export const ReviewSchema = z.object({
  verdikt: z.enum(["v_poriadku", "na_zvazenie"]),
  zistenia: z.array(
    z.object({
      zavaznost: z.enum(SEVERITIES),
      problem: z.string(),
      odporucanie: z.string(),
    }),
  ),
});

export type Review = z.infer<typeof ReviewSchema>;
export type ReviewFinding = Review["zistenia"][number];

export const REVIEW_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdikt: {
      type: "STRING",
      enum: ["v_poriadku", "na_zvazenie"],
      description: "v_poriadku ak návrh nemá rizikové miesta, inak na_zvazenie.",
    },
    zistenia: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          zavaznost: { type: "STRING", enum: [...SEVERITIES], description: "Závažnosť zistenia." },
          problem: { type: "STRING", description: "Krátko, čo je na návrhu rizikové vzhľadom na pacienta." },
          odporucanie: { type: "STRING", description: "Konkrétne, čo zmeniť alebo na čo si dať pozor." },
        },
        required: ["zavaznost", "problem", "odporucanie"],
      },
    },
  },
  required: ["verdikt", "zistenia"],
} as const;

export function buildReviewPrompt(patientContext: string, answer: string): string {
  return `Si nezávislý odborný recenzent. Skontroluj návrh fyzioterapeutického asistenta voči údajom pacienta.

Zameraj sa na:
- cviky alebo odporúčania, ktoré kolidujú s diagnózami, obmedzeniami či kontraindikáciami pacienta,
- chýbajúce upozornenia na varovné príznaky (red flags),
- záťaž nevhodnú pre vek, BMI alebo typ práce pacienta.

Pravidlá:
- Hodnoť iba podľa uvedených údajov. Nič si nevymýšľaj.
- Ak je návrh bezpečný, vráť verdikt "v_poriadku" a prázdne pole zistení.
- Každé zistenie má závažnosť (vysoka, stredna, nizka), stručný problém a konkrétne odporúčanie.

${patientContext}

## Návrh na kontrolu
<<<
${answer}
>>>`;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function normalizeReview(review: Review): Review {
  const zistenia = review.zistenia
    .filter((finding) => finding.problem.trim())
    .slice(0, MAX_FINDINGS)
    .map((finding) => ({
      zavaznost: finding.zavaznost,
      problem: clip(finding.problem, 300),
      odporucanie: clip(finding.odporucanie, 300),
    }));
  return { verdikt: zistenia.length === 0 ? "v_poriadku" : review.verdikt, zistenia };
}
