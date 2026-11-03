import { after } from "next/server";
import * as z from "zod";
import { CONTINUE_PROMPT, buildSystemInstruction } from "@/lib/ai/context";
import type { Patient } from "@/lib/patients/model";
import { hasSession } from "@/lib/server/auth";
import {
  addUserMessage,
  answerWriter,
  conversationTitle,
  createConversation,
  getConversation,
  recentTurns,
  type AnswerWriter,
} from "@/lib/server/conversations";
import { listLibraryForAi } from "@/lib/server/exercises";
import { AI_ERROR_RESPONSES, AiError, type ChatTurn } from "@/lib/server/ai-common";
import { streamChat } from "@/lib/server/llm";
import { getPatient } from "@/lib/server/patients";

const BodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("message"),
    conversationId: z.uuid().nullable(),
    patientId: z.uuid().nullable(),
    answerId: z.uuid(),
    message: z.string().trim().min(1).max(4000),
  }),
  z.object({
    mode: z.literal("continue"),
    conversationId: z.uuid(),
    answerId: z.uuid(),
    revision: z.int().min(1).max(1000),
    partial: z.string().min(1).max(100_000),
  }),
]);

type Body = z.infer<typeof BodySchema>;

type Prepared = {
  patient: Patient | null;
  turns: ChatTurn[];
  commit: () => Promise<{ conversationId: string; save: AnswerWriter }>;
};

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function loadPatient(patientId: string | null): Promise<Patient | null> {
  if (!patientId) return null;
  const patient = await getPatient(patientId);
  if (!patient) throw new RequestError(404, "Pacient neexistuje.");
  return patient;
}

async function prepare(body: Body): Promise<Prepared> {
  if (body.mode === "continue") {
    const conversation = await getConversation(body.conversationId);
    if (!conversation) throw new RequestError(404, "Rozhovor neexistuje.");
    const [patient, history] = await Promise.all([
      loadPatient(conversation.patient_id),
      recentTurns(body.conversationId, body.answerId),
    ]);
    return {
      patient,
      turns: [...history, { role: "model", content: body.partial }, { role: "user", content: CONTINUE_PROMPT }],
      commit: async () => {
        const write = await answerWriter(body.conversationId, body.answerId, body.revision);
        await write(body.partial);
        return { conversationId: body.conversationId, save: (answer) => write(body.partial + answer) };
      },
    };
  }

  let patientId = body.patientId;
  if (body.conversationId) {
    const conversation = await getConversation(body.conversationId);
    if (!conversation) throw new RequestError(404, "Rozhovor neexistuje.");
    patientId = conversation.patient_id;
  }
  const [patient, history] = await Promise.all([
    loadPatient(patientId),
    body.conversationId ? recentTurns(body.conversationId) : Promise.resolve([]),
  ]);
  return {
    patient,
    turns: [...history, { role: "user", content: body.message }],
    commit: async () => {
      const conversationId = body.conversationId ?? (await createConversation(patientId, conversationTitle(body.message)));
      await addUserMessage(conversationId, body.message);
      return { conversationId, save: await answerWriter(conversationId, body.answerId, 0) };
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!(await hasSession())) return jsonError(401, "Nie ste prihlásená.");

  let body: Body;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return jsonError(400, "Neplatná požiadavka.");
  }

  try {
    const [{ patient, turns, commit }, library] = await Promise.all([prepare(body), listLibraryForAi()]);
    const { stream, provider } = await streamChat(buildSystemInstruction(patient, library), turns, request.signal);
    const { conversationId, save } = await commit();

    let answer = "";
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    request.signal.addEventListener("abort", () => finish(), { once: true });
    after(async () => {
      await finished;
      if (!answer.trim()) return;
      try {
        await save(answer);
      } catch (error) {
        console.error("Saving AI answer failed:", error);
      }
    });

    const encoder = new TextEncoder();
    const reader = stream.getReader();
    const output = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            finish();
            controller.close();
            return;
          }
          answer += value;
          controller.enqueue(encoder.encode(value));
        } catch (error) {
          finish();
          controller.error(error);
        }
      },
      async cancel(reason) {
        finish();
        await reader.cancel(reason);
      },
    });

    return new Response(output, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": conversationId,
        "X-AI-Provider": provider,
      },
    });
  } catch (error) {
    if (error instanceof RequestError) return jsonError(error.status, error.message);
    if (error instanceof AiError) {
      console.error("AI error:", error.message);
      const { status, message } = AI_ERROR_RESPONSES[error.kind];
      return jsonError(status, message);
    }
    if (request.signal.aborted) return jsonError(499, "Požiadavka bola zrušená.");
    console.error("Chat request failed:", error);
    return jsonError(500, "Nastala chyba. Skúste to znova.");
  }
}
