"use server";

import * as z from "zod";
import {
  deleteConversation,
  listConversations,
  listMessages,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/server/conversations";

const OptionalId = z.uuid().nullable();
const Id = z.uuid();

export async function loadConversations(patientId: string | null): Promise<ConversationSummary[]> {
  return listConversations(OptionalId.parse(patientId));
}

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  return listMessages(Id.parse(conversationId));
}

export async function removeConversation(conversationId: string): Promise<boolean> {
  return deleteConversation(Id.parse(conversationId));
}
