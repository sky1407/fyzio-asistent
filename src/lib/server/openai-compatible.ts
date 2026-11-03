import "server-only";
import * as z from "zod";
import { AiError, REQUEST_TIMEOUT_MS, errorKindFromStatus, type ChatTurn } from "./ai-common";

export type CompatibleProvider = {
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraBody: Record<string, unknown>;
};

type Env = Record<string, string | undefined>;

export function compatibleProviders(env: Env = process.env): CompatibleProvider[] {
  const providers: CompatibleProvider[] = [];
  const groqKey = env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const model = env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
    providers.push({
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      model,
      extraBody: model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {},
    });
  }
  return providers;
}

const DeltaChunkSchema = z.object({
  choices: z.array(z.object({ delta: z.object({ content: z.string().nullish() }).nullish() })).optional(),
});

export function createChatCompletionSseParser(): (chunk: string) => string[] {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    const texts: string[] = [];
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let json: unknown;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      const parsed = DeltaChunkSchema.safeParse(json);
      const content = parsed.success ? parsed.data.choices?.[0]?.delta?.content : null;
      if (content) texts.push(content);
    }
    return texts;
  };
}

export function toStrictJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictJsonSchema);
  if (typeof schema !== "object" || schema === null) return schema;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    result[key] = key === "type" && typeof value === "string" ? value.toLowerCase() : toStrictJsonSchema(value);
  }
  if (result.type === "object" && typeof result.properties === "object" && result.properties !== null) {
    result.required = Object.keys(result.properties);
    result.additionalProperties = false;
  }
  return result;
}

function toMessages(system: string | null, history: ChatTurn[]) {
  const messages = history.map((turn) => ({
    role: turn.role === "model" ? "assistant" : "user",
    content: turn.content,
  }));
  return system ? [{ role: "system", content: system }, ...messages] : messages;
}

async function request(provider: CompatibleProvider, body: object, signal: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, ...provider.extraBody, ...body }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AiError(
      "failed",
      `${provider.label} request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new AiError(errorKindFromStatus(response.status), `${provider.label} returned HTTP ${response.status}: ${detail}`);
  }
  return response;
}

export async function streamCompatible(
  provider: CompatibleProvider,
  system: string,
  history: ChatTurn[],
  signal: AbortSignal,
): Promise<ReadableStream<string>> {
  const response = await request(
    provider,
    { messages: toMessages(system, history), stream: true, temperature: 0.7, max_completion_tokens: 8192 },
    signal,
  );
  if (!response.body) throw new AiError("failed", `${provider.label} returned an empty body`);

  const parse = createChatCompletionSseParser();
  return response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream<string, string>({
      transform(chunk, controller) {
        for (const text of parse(chunk)) controller.enqueue(text);
      },
    }),
  );
}

const CompletionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullish() }) })).min(1),
});

export async function generateCompatibleJson<T>(
  provider: CompatibleProvider,
  prompt: string,
  responseSchema: object,
  validator: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const response = await request(
    provider,
    {
      messages: toMessages(null, [{ role: "user", content: prompt }]),
      temperature: 0.2,
      max_completion_tokens: 8192,
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: toStrictJsonSchema(responseSchema) },
      },
    },
    signal,
  );

  const completion = CompletionSchema.safeParse(await response.json().catch(() => null));
  const content = completion.success ? completion.data.choices[0].message.content : null;
  if (!content) throw new AiError("failed", `${provider.label} returned no content`);

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new AiError("failed", `${provider.label} returned malformed JSON`);
  }
  const parsed = validator.safeParse(data);
  if (!parsed.success) throw new AiError("failed", `${provider.label} JSON did not match the schema`);
  return parsed.data;
}
