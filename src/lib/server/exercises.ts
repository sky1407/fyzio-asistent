import "server-only";
import * as z from "zod";
import { LIBRARY_LIMIT, type LibraryExercise } from "@/lib/ai/context";
import { EXERCISE_FIELDS, ExerciseSchema, exerciseKey, type Exercise, type ExerciseInput } from "@/lib/exercises/model";
import { requireSession } from "./auth";
import { getSql } from "./db";

export type SaveExerciseResult = { status: "ok"; id: string } | { status: "duplicate" } | { status: "not_found" };

const COLUMNS = `id, ${EXERCISE_FIELDS.join(", ")}`;
const ExerciseRows = z.array(ExerciseSchema);
const IdRows = z.array(z.object({ id: z.uuid() }));

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listExercises(search: string): Promise<Exercise[]> {
  await requireSession();
  const term = search.trim().slice(0, 100);
  const sql = getSql();
  const rows = term
    ? await sql.query(
        `SELECT ${COLUMNS} FROM exercises
         WHERE unaccent(name || ' ' || target || ' ' || description) ILIKE unaccent($1)
         ORDER BY lower(name) LIMIT 1000`,
        [`%${escapeLike(term)}%`],
      )
    : await sql.query(`SELECT ${COLUMNS} FROM exercises ORDER BY lower(name) LIMIT 1000`);
  return ExerciseRows.parse(rows);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  await requireSession();
  if (!isUuid(id)) return null;
  return ExerciseRows.parse(await getSql().query(`SELECT ${COLUMNS} FROM exercises WHERE id = $1`, [id]))[0] ?? null;
}

export async function createExercise(input: ExerciseInput): Promise<SaveExerciseResult> {
  await requireSession();
  if ((await takenKeys()).has(exerciseKey(input.name))) return { status: "duplicate" };
  const placeholders = EXERCISE_FIELDS.map((_, index) => `$${index + 1}`).join(", ");
  const rows = IdRows.parse(
    await getSql().query(
      `INSERT INTO exercises (${EXERCISE_FIELDS.join(", ")}) VALUES (${placeholders})
       ON CONFLICT ((lower(name))) DO NOTHING RETURNING id`,
      EXERCISE_FIELDS.map((field) => input[field]),
    ),
  );
  return rows[0] ? { status: "ok", id: rows[0].id } : { status: "duplicate" };
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<SaveExerciseResult> {
  await requireSession();
  if (!isUuid(id)) return { status: "not_found" };
  if ((await takenKeys(id)).has(exerciseKey(input.name))) return { status: "duplicate" };
  const assignments = EXERCISE_FIELDS.map((field, index) => `${field} = $${index + 2}`).join(", ");
  try {
    const rows = IdRows.parse(
      await getSql().query(`UPDATE exercises SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING id`, [
        id,
        ...EXERCISE_FIELDS.map((field) => input[field]),
      ]),
    );
    return rows[0] ? { status: "ok", id } : { status: "not_found" };
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "duplicate" };
    throw error;
  }
}

async function takenKeys(excludeId?: string): Promise<Set<string>> {
  const rows = z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .parse(await getSql().query("SELECT id, name FROM exercises"));
  return new Set(rows.filter((row) => row.id !== excludeId).map((row) => exerciseKey(row.name)));
}

export async function listLibraryForAi(): Promise<LibraryExercise[]> {
  await requireSession();
  const rows = await getSql().query("SELECT name, target FROM exercises ORDER BY updated_at DESC LIMIT $1", [
    LIBRARY_LIMIT,
  ]);
  return z.array(z.object({ name: z.string(), target: z.string() })).parse(rows);
}

export async function listExerciseKeys(): Promise<Set<string>> {
  await requireSession();
  return takenKeys();
}

export async function addExercises(candidates: ExerciseInput[]): Promise<number> {
  await requireSession();
  const taken = await takenKeys();
  const inputs = candidates.filter((input) => {
    const key = exerciseKey(input.name);
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  if (inputs.length === 0) return 0;
  const column = (field: keyof ExerciseInput) => inputs.map((input) => input[field]);
  const rows = await getSql().query(
    `INSERT INTO exercises (name, target, description, video_url)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
     ON CONFLICT ((lower(name))) DO NOTHING RETURNING id`,
    [column("name"), column("target"), column("description"), column("video_url")],
  );
  return IdRows.parse(rows).length;
}

export async function deleteExercise(id: string): Promise<boolean> {
  await requireSession();
  if (!isUuid(id)) return false;
  return IdRows.parse(await getSql().query("DELETE FROM exercises WHERE id = $1 RETURNING id", [id])).length === 1;
}
