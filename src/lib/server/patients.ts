import "server-only";
import * as z from "zod";
import { PATIENT_FIELDS, PatientSchema, type Patient, type PatientInput } from "@/lib/patients/model";
import { requireSession } from "./auth";
import { getSql } from "./db";

const COLUMNS = PATIENT_FIELDS.map((field) =>
  field === "height_cm" || field === "weight_kg" ? `${field}::float8 AS ${field}` : field,
).join(", ");

const PatientRows = z.array(PatientSchema);
const IdRows = z.array(z.object({ id: z.uuid() }));

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listPatients(search: string): Promise<Patient[]> {
  await requireSession();
  const sql = getSql();
  const term = search.trim().slice(0, 100);
  if (!term) {
    return PatientRows.parse(
      await sql.query(`SELECT id, ${COLUMNS} FROM patients ORDER BY last_name, first_name LIMIT 500`),
    );
  }
  return PatientRows.parse(
    await sql.query(
      `SELECT id, ${COLUMNS} FROM patients
       WHERE unaccent(first_name || ' ' || last_name || ' ' || occupation || ' ' || diagnoses) ILIKE unaccent($1)
       ORDER BY last_name, first_name LIMIT 500`,
      [`%${escapeLike(term)}%`],
    ),
  );
}

export async function getPatient(id: string): Promise<Patient | null> {
  await requireSession();
  if (!isUuid(id)) return null;
  const rows = PatientRows.parse(await getSql().query(`SELECT id, ${COLUMNS} FROM patients WHERE id = $1`, [id]));
  return rows[0] ?? null;
}

export async function createPatient(input: PatientInput): Promise<string> {
  await requireSession();
  const placeholders = PATIENT_FIELDS.map((_, index) => `$${index + 1}`).join(", ");
  const rows = IdRows.parse(
    await getSql().query(
      `INSERT INTO patients (${PATIENT_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING id`,
      PATIENT_FIELDS.map((field) => input[field]),
    ),
  );
  return rows[0].id;
}

export async function updatePatient(id: string, input: PatientInput): Promise<boolean> {
  await requireSession();
  if (!isUuid(id)) return false;
  const assignments = PATIENT_FIELDS.map((field, index) => `${field} = $${index + 2}`).join(", ");
  const rows = IdRows.parse(
    await getSql().query(`UPDATE patients SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING id`, [
      id,
      ...PATIENT_FIELDS.map((field) => input[field]),
    ]),
  );
  return rows.length === 1;
}

export async function deletePatient(id: string): Promise<boolean> {
  await requireSession();
  if (!isUuid(id)) return false;
  const rows = IdRows.parse(await getSql().query("DELETE FROM patients WHERE id = $1 RETURNING id", [id]));
  return rows.length === 1;
}
