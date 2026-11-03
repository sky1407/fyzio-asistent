import * as z from "zod";
import { CONTINUE_PROMPT, buildSystemInstruction } from "@/lib/ai/context";
import type { Patient } from "@/lib/patients/model";
import { hasSession } from "@/lib/server/auth";
import {
  addMessage,
  answerWriter,
  conversationTitle,
  createConversation,
  getConversation,
  lastMessage,
  recentTurns,
} from "@/lib/server/conversations";
import { listLibraryForAi } from "@/lib/server/exercises";
import { GEMINI_ERROR_RESPONSES, GeminiError, streamChat, type ChatTurn } from "@/lib/server/gemini";
import { getPatient } from "@/lib/server/patients";

const BodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("message"),
    conversationId: z.uuid().nullable(),
    patientId: z.uuid().nullable(),
    message: z.string().trim().min(1).max(4000),
  }),
  z.object({
    mode: z.literal("continue"),
    conversationId: z.uuid(),
    partial: z.string().min(1).max(100_000),
  }),
]);

type Body = z.infer<typeof BodySchema>;

type Committed = {
  conversationId: string;
  save: (answer: string) => Promise<void>;
};

type Prepared = {
  patient: Patient | null;
  turns: ChatTurn[];
  commit: () => Promise<Committed>;
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
    const last = await lastMessage(body.conversationId);
    if (!last || last.role !== "model") throw new RequestError(409, "Nie je čo dokončiť.");
    const [patient, history] = await Promise.all([loadPatient(conversation.patient_id), recentTurns(body.conversationId)]);
    const shownHistory = history.map((turn, index) =>
      index === history.length - 1 ? { ...turn, content: body.partial } : turn,
    );
    return {
      patient,
      turns: [...shownHistory, { role: "user", content: CONTINUE_PROMPT }],
      commit: async () => {
        const writer = await answerWriter(body.conversationId);
        await writer.replace(last.id, body.partial);
        return {
          conversationId: body.conversationId,
          save: (answer) => writer.replace(last.id, body.partial + answer),
        };
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
      await addMessage(conversationId, "user", body.message);
      const writer = await answerWriter(conversationId);
      return { conversationId, save: writer.add };
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
    const stream = await streamChat(buildSystemInstruction(patient, library), turns, request.signal);
    const { conversationId, save } = await commit();

    let answer = "";
    let saved = false;
    const persist = async () => {
      if (saved || !answer.trim()) return;
      saved = true;
      try {
        await save(answer);
      } catch (error) {
        console.error("Saving AI answer failed:", error);
      }
    };
    request.signal.addEventListener("abort", () => void persist(), { once: true });

    const encoder = new TextEncoder();
    const output = stream.pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          answer += chunk;
          controller.enqueue(encoder.encode(chunk));
        },
        flush: persist,
      }),
    );

    return new Response(output, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": conversationId,
      },
    });
  } catch (error) {
    if (error instanceof RequestError) return jsonError(error.status, error.message);
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
