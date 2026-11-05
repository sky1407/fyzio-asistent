import * as z from "zod";

export const MAX_ITEMS = 12;

export const AnswerSummarySchema = z.object({
  hlavny_problem: z.string(),
  odporucane_cviky: z.array(z.string()),
  kontraindikacie: z.array(z.string()),
  red_flags: z.array(z.string()),
});

export type AnswerSummary = z.infer<typeof AnswerSummarySchema>;

export const SUMMARY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hlavny_problem: {
      type: "STRING",
      description: "Jedna stručná veta – hlavný problém alebo cieľ, ktorého sa odpoveď týka.",
    },
    odporucane_cviky: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Krátke názvy odporúčaných cvikov z odpovede, bez sérií a opakovaní.",
    },
    kontraindikacie: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Čomu sa vyhnúť alebo na čo si dať pozor podľa odpovede.",
    },
    red_flags: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Varovné príznaky, pri ktorých odpoveď odporúča lekárske vyšetrenie.",
    },
  },
  required: ["hlavny_problem", "odporucane_cviky", "kontraindikacie", "red_flags"],
} as const;

export function buildSummaryPrompt(answer: string): string {
  return `Zhrň nasledujúcu odpoveď AI asistenta fyzioterapeutky do štruktúrovaných údajov.

Pravidlá:
- Vychádzaj iba z textu odpovede. Nič nevymýšľaj ani nedopĺňaj z vlastných vedomostí.
- hlavny_problem: jedna stručná veta, čoho sa odpoveď týka (napr. "Bolesť krížovej chrbtice pri sedavej práci").
- odporucane_cviky: krátke názvy cvikov spomenutých v odpovedi, bez sérií, opakovaní a zátvoriek. Ak žiadne nie sú, vráť prázdne pole.
- kontraindikacie: čomu sa pacient má vyhnúť alebo na čo si dať pozor. Ak nič, vráť prázdne pole.
- red_flags: varovné príznaky, pri ktorých odpoveď odporúča lekárske vyšetrenie. Ak nič, vráť prázdne pole.

ODPOVEĎ:
<<<
${answer}
>>>`;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function cleanList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = clip(item, 200);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length === MAX_ITEMS) break;
  }
  return result;
}

export function normalizeSummary(summary: AnswerSummary): AnswerSummary {
  return {
    hlavny_problem: clip(summary.hlavny_problem, 300),
    odporucane_cviky: cleanList(summary.odporucane_cviky),
    kontraindikacie: cleanList(summary.kontraindikacie),
    red_flags: cleanList(summary.red_flags),
  };
}

export function isSummaryEmpty(summary: AnswerSummary): boolean {
  return (
    !summary.hlavny_problem &&
    summary.odporucane_cviky.length === 0 &&
    summary.kontraindikacie.length === 0 &&
    summary.red_flags.length === 0
  );
}
