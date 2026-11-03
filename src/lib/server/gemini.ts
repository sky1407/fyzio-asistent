import "server-only";
import * as z from "zod";
import { AiError, REQUEST_TIMEOUT_MS, errorKindFromStatus, type ChatTurn } from "./ai-common";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"];
const RETRYABLE_STATUSES = new Set([404, 429, 500, 503]);

const ChunkSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
});

function thinkingConfig(model: string): Record<string, string | number> {
  return model.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
}

function modelOrder(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim();
  return configured ? [configured, ...FALLBACK_MODELS.filter((model) => model !== configured)] : FALLBACK_MODELS;
}

export function createSseTextParser(): (chunk: string) => string[] {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    const texts: string[] = [];
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      let json: unknown;
      try {
        json = JSON.parse(line.slice(5));
      } catch {
        continue;
      }
      const parsed = ChunkSchema.safeParse(json);
      if (!parsed.success) continue;
      for (const part of parsed.data.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) texts.push(part.text);
      }
    }
    return texts;
  };
}

type GeminiMethod = "streamGenerateContent?alt=sse" | "generateContent";

async function requestWithFallback(
  method: GeminiMethod,
  buildBody: (model: string) => object,
  signal: AbortSignal,
): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("config", "GEMINI_API_KEY is not set");
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);

  let lastStatus = 0;
  for (const model of modelOrder()) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(buildBody(model)),
        signal: requestSignal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new AiError("failed", `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (response.ok) return response;

    lastStatus = response.status;
    await response.body?.cancel();
    console.warn(`Gemini model ${model} returned HTTP ${response.status}`);
    if (!RETRYABLE_STATUSES.has(response.status)) break;
  }
  throw new AiError(errorKindFromStatus(lastStatus), `Gemini request failed with HTTP ${lastStatus}`);
}

export async function streamGemini(
  systemInstruction: string,
  history: ChatTurn[],
  signal: AbortSignal,
): Promise<ReadableStream<string>> {
  const contents = history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] }));
  const response = await requestWithFallback(
    "streamGenerateContent?alt=sse",
    (model) => ({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192, thinkingConfig: thinkingConfig(model) },
    }),
    signal,
  );
  if (!response.body) throw new AiError("failed", "Gemini returned an empty body");

  const parse = createSseTextParser();
  return response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream<string, string>({
      transform(chunk, controller) {
        for (const text of parse(chunk)) controller.enqueue(text);
      },
    }),
  );
}

const JsonEnvelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })),
        }),
      }),
    )
    .min(1),
});

export async function generateGeminiJson<T>(
  prompt: string,
  responseSchema: object,
  validator: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const response = await requestWithFallback(
    "generateContent",
    (model) => ({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: thinkingConfig(model),
      },
    }),
    signal,
  );

  const envelope = JsonEnvelopeSchema.safeParse(await response.json().catch(() => null));
  if (!envelope.success) throw new AiError("failed", "Gemini returned no candidates");
  const text = envelope.data.candidates[0].content.parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AiError("failed", "Gemini returned malformed JSON");
  }
  const parsed = validator.safeParse(data);
  if (!parsed.success) throw new AiError("failed", "Gemini JSON did not match the schema");
  return parsed.data;
}
