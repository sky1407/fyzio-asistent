import * as z from "zod";
import { buildSystemInstruction } from "@/lib/ai/context";
import type { Patient } from "@/lib/patients/model";
import { hasSession } from "@/lib/server/auth";
import {
  addMessage,
  conversationTitle,
  createConversation,
  getConversation,
  recentTurns,
} from "@/lib/server/conversations";
import { listLibraryForAi } from "@/lib/server/exercises";
import { GEMINI_ERROR_RESPONSES, GeminiError, streamChat } from "@/lib/server/gemini";
import { getPatient } from "@/lib/server/patients";

const BodySchema = z.object({
  conversationId: z.uuid().nullable(),
  patientId: z.uuid().nullable(),
  message: z.string().trim().min(1).max(4000),
});

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  if (!(await hasSession())) return jsonError(401, "Nie ste prihlásená.");

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return jsonError(400, "Neplatná požiadavka.");
  }

  try {
    const conversationId = body.conversationId;
    let patientId = body.patientId;
    if (conversationId) {
      const conversation = await getConversation(conversationId);
      if (!conversation) return jsonError(404, "Rozhovor neexistuje.");
      patientId = conversation.patient_id;
    }

    let patient: Patient | null = null;
    if (patientId) {
      patient = await getPatient(patientId);
      if (!patient) return jsonError(404, "Pacient neexistuje.");
    }

    const [history, library] = await Promise.all([
      conversationId ? recentTurns(conversationId) : Promise.resolve([]),
      listLibraryForAi(),
    ]);
    const stream = await streamChat(
      buildSystemInstruction(patient, library),
      [...history, { role: "user", content: body.message }],
      request.signal,
    );

    const savedConversationId = conversationId ?? (await createConversation(patientId, conversationTitle(body.message)));
    await addMessage(savedConversationId, "user", body.message);

    const encoder = new TextEncoder();
    let answer = "";
    const output = stream.pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          answer += chunk;
          controller.enqueue(encoder.encode(chunk));
        },
        async flush() {
          if (!answer.trim()) return;
          try {
            await addMessage(savedConversationId, "model", answer);
          } catch (error) {
            console.error("Saving AI answer failed:", error);
          }
        },
      }),
    );

    return new Response(output, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": savedConversationId,
      },
    });
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error("Gemini error:", error.message);
      const { status, message } = GEMINI_ERROR_RESPONSES[error.kind];
      return jsonError(status, message);
    }
    if (request.signal.aborted) return jsonError(499, "Požiadavka bola zrušená.");
    console.error("Chat request failed:", error);
    return jsonError(500, "Nastala chyba. Skúste to znova.");
  }
}
