import * as z from "zod";

function text(max: number) {
  return z.preprocess(
    (value) => value ?? "",
    z.string().trim().max(max, { error: `Maximálne ${max} znakov.` }),
  );
}

export const ExerciseInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Zadajte názov cviku." })
    .max(200, { error: "Maximálne 200 znakov." }),
  description: text(4000),
  target: text(300),
  video_url: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.union([
      z.literal(""),
      z
        .url({ protocol: /^https?$/, error: "Zadajte celý odkaz začínajúci https://" })
        .max(500, { error: "Odkaz je príliš dlhý." }),
    ]),
  ),
});

export type ExerciseInput = z.infer<typeof ExerciseInputSchema>;

export const ExerciseSchema = ExerciseInputSchema.extend({ id: z.uuid() });

export type Exercise = z.infer<typeof ExerciseSchema>;

export const EXERCISE_FIELDS = Object.keys(ExerciseInputSchema.shape) as (keyof ExerciseInput)[];

export function exerciseKey(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?${new URLSearchParams({ search_query: name })}`;
}
