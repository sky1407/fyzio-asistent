import "server-only";
import * as z from "zod";
import type { PlanInput } from "@/lib/plans/model";
import { requireSession } from "./auth";
import { getSql } from "./db";

const UPDATED_LABEL = `to_char(updated_at AT TIME ZONE 'Europe/Bratislava', 'FMDD. FMMM. YYYY HH24:MI') AS updated_label`;

const PlanSummarySchema = z.object({ id: z.uuid(), title: z.string(), updated_label: z.string() });
const PlanSchema = PlanSummarySchema.extend({ patient_id: z.uuid(), content: z.string() });
const IdRows = z.array(z.object({ id: z.uuid() }));

export type PlanSummary = z.infer<typeof PlanSummarySchema>;
export type Plan = z.infer<typeof PlanSchema>;

function areUuids(...values: string[]): boolean {
  return values.every((value) => z.uuid().safeParse(value).success);
}

export async function listPlans(patientId: string): Promise<PlanSummary[]> {
  await requireSession();
  if (!areUuids(patientId)) return [];
  const rows = await getSql().query(
    `SELECT id, title, ${UPDATED_LABEL} FROM plans WHERE patient_id = $1 ORDER BY updated_at DESC LIMIT 200`,
    [patientId],
  );
  return z.array(PlanSummarySchema).parse(rows);
}

export async function getPlan(patientId: string, planId: string): Promise<Plan | null> {
  await requireSession();
  if (!areUuids(patientId, planId)) return null;
  const rows = await getSql().query(
    `SELECT id, patient_id, title, content, ${UPDATED_LABEL} FROM plans WHERE id = $1 AND patient_id = $2`,
    [planId, patientId],
  );
  return z.array(PlanSchema).parse(rows)[0] ?? null;
}

export async function createPlan(patientId: string, input: PlanInput): Promise<string | null> {
  await requireSession();
  if (!areUuids(patientId)) return null;
  const rows = await getSql().query(
    "INSERT INTO plans (patient_id, title, content) SELECT id, $2, $3 FROM patients WHERE id = $1 RETURNING id",
    [patientId, input.title, input.content],
  );
  return IdRows.parse(rows)[0]?.id ?? null;
}

export async function updatePlan(patientId: string, planId: string, input: PlanInput): Promise<boolean> {
  await requireSession();
  if (!areUuids(patientId, planId)) return false;
  const rows = await getSql().query(
    "UPDATE plans SET title = $3, content = $4, updated_at = now() WHERE id = $1 AND patient_id = $2 RETURNING id",
    [planId, patientId, input.title, input.content],
  );
  return IdRows.parse(rows).length === 1;
}

export async function deletePlan(patientId: string, planId: string): Promise<boolean> {
  await requireSession();
  if (!areUuids(patientId, planId)) return false;
  const rows = await getSql().query("DELETE FROM plans WHERE id = $1 AND patient_id = $2 RETURNING id", [
    planId,
    patientId,
  ]);
  return IdRows.parse(rows).length === 1;
}
