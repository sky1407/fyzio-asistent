import * as z from "zod";
import { exerciseKey, type ExerciseInput } from "@/lib/exercises/model";

export const MAX_EXTRACTED = 30;

export const ExtractionResultSchema = z.object({
  exercises: z.array(z.object({ name: z.string(), target: z.string(), description: z.string() })),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const EXTRACTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    exercises: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Krátky slovenský názov cviku bez zátvoriek, číslovania a sérií." },
          target: { type: "STRING", description: "Krátka fráza, na čo je cvik zameraný." },
          description: { type: "STRING", description: "Popis vykonania cviku v 2 až 4 vetách." },
        },
        required: ["name", "target", "description"],
      },
    },
  },
  required: ["exercises"],
} as const;

export function buildExtractionPrompt(planContent: string): string {
  return `Z nasledujúceho plánu fyzioterapeutky vyber všetky konkrétne cviky.

Pravidlá:
- Vyber iba cviky, ktoré v pláne naozaj sú. Nič nevymýšľaj.
- name: krátky slovenský názov (napr. "Mačací chrbát", "Mostík"), bez anglického prekladu, zátvoriek, čísla, sérií a opakovaní.
- target: krátka fráza bez úvodu "Cvik je zameraný na", napr. "posilnenie sedacích svalov".
- description: ako sa cvik vykonáva a na čo si dať pozor. Neuvádzaj série, opakovania ani frekvenciu, tie patria k plánu.
- Ignoruj stravu, jedálniček a všeobecné rady.
- Ak sa cvik v pláne opakuje, uveď ho iba raz.
- Ak plán neobsahuje žiadne cviky, vráť prázdne pole.

PLÁN:
<<<
${planContent}
>>>`;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function normalizeExtracted(result: ExtractionResult): ExerciseInput[] {
  const seen = new Set<string>();
  const exercises: ExerciseInput[] = [];
  for (const item of result.exercises) {
    const name = clip(item.name.replace(/^\s*\d+[.)]\s*/, ""), 200);
    const key = exerciseKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    exercises.push({ name, target: clip(item.target, 300), description: clip(item.description, 4000), video_url: "" });
    if (exercises.length === MAX_EXTRACTED) break;
  }
  return exercises;
}
