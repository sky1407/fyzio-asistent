import "server-only";
import * as z from "zod";
import { requireSession } from "./auth";
import { getSql } from "./db";
import type { ChatTurn } from "./gemini";

export const HISTORY_LIMIT = 30;

const ConversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  updated_label: z.string(),
});

const ConversationSchema = z.object({ id: z.uuid(), patient_id: z.uuid().nullable() });

const MessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "model"]),
  content: z.string(),
});

const IdRows = z.array(z.object({ id: z.uuid() }));

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ChatMessage = z.infer<typeof MessageSchema>;

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export function conversationTitle(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 80 ? `${singleLine.slice(0, 77)}…` : singleLine;
}

export async function listConversations(patientId: string | null): Promise<ConversationSummary[]> {
  await requireSession();
  if (patientId !== null && !isUuid(patientId)) return [];
  const rows = await getSql().query(
    `SELECT id, title, to_char(updated_at AT TIME ZONE 'Europe/Bratislava', 'FMDD. FMMM. YYYY HH24:MI') AS updated_label
     FROM conversations WHERE patient_id IS NOT DISTINCT FROM $1 ORDER BY updated_at DESC LIMIT 100`,
    [patientId],
  );
  return z.array(ConversationSummarySchema).parse(rows);
}

export async function getConversation(id: string): Promise<z.infer<typeof ConversationSchema> | null> {
  await requireSession();
  if (!isUuid(id)) return null;
  const rows = await getSql().query("SELECT id, patient_id FROM conversations WHERE id = $1", [id]);
  return z.array(ConversationSchema).parse(rows)[0] ?? null;
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  await requireSession();
  if (!isUuid(conversationId)) return [];
  const rows = await getSql().query(
    "SELECT id, role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at, id",
    [conversationId],
  );
  return z.array(MessageSchema).parse(rows);
}

export async function recentTurns(conversationId: string, excludeMessageId?: string): Promise<ChatTurn[]> {
  const messages = await listMessages(conversationId);
  return messages
    .filter((message) => message.id !== excludeMessageId)
    .slice(-HISTORY_LIMIT)
    .map(({ role, content }) => ({ role, content }));
}

export async function createConversation(patientId: string | null, title: string): Promise<string> {
  await requireSession();
  const rows = await getSql().query("INSERT INTO conversations (patient_id, title) VALUES ($1, $2) RETURNING id", [
    patientId,
    title,
  ]);
  return IdRows.parse(rows)[0].id;
}

export async function addUserMessage(conversationId: string, content: string): Promise<void> {
  await requireSession();
  const sql = getSql();
  await sql.transaction([
    sql.query("INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [conversationId, content]),
    sql.query("UPDATE conversations SET updated_at = now() WHERE id = $1", [conversationId]),
  ]);
}

export type AnswerWriter = (content: string) => Promise<void>;

export async function answerWriter(conversationId: string, answerId: string, revision: number): Promise<AnswerWriter> {
  await requireSession();
  const sql = getSql();
  return async (content) => {
    await sql.transaction([
      sql.query(
        `INSERT INTO messages (id, conversation_id, role, content, revision) VALUES ($1, $2, 'model', $3, $4)
         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, revision = EXCLUDED.revision
         WHERE messages.conversation_id = EXCLUDED.conversation_id
           AND messages.role = 'model'
           AND messages.revision <= EXCLUDED.revision`,
        [answerId, conversationId, content, revision],
      ),
      sql.query("UPDATE conversations SET updated_at = now() WHERE id = $1", [conversationId]),
    ]);
  };
}

export async function deleteConversation(id: string): Promise<boolean> {
  await requireSession();
  if (!isUuid(id)) return false;
  const rows = await getSql().query("DELETE FROM conversations WHERE id = $1 RETURNING id", [id]);
  return IdRows.parse(rows).length === 1;
}
