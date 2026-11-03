import "server-only";
import type * as z from "zod";
import { AiError, type ChatTurn } from "./ai-common";
import { generateGeminiJson, streamGemini } from "./gemini";
import { compatibleProviders, generateCompatibleJson, streamCompatible } from "./openai-compatible";

export type Attempt<T> = { provider: string; run: () => Promise<T> };

export async function withFallback<T>(
  attempts: Attempt<T>[],
  signal: AbortSignal,
): Promise<{ value: T; provider: string }> {
  const errors: AiError[] = [];
  for (const attempt of attempts) {
    try {
      return { value: await attempt.run(), provider: attempt.provider };
    } catch (error) {
      if (signal.aborted || !(error instanceof AiError)) throw error;
      console.warn(`AI provider ${attempt.provider} failed (${error.kind}): ${error.message}`);
      errors.push(error);
    }
  }
  throw errors.find((error) => error.kind === "rate_limited") ?? errors.at(-1) ?? new AiError("config", "No AI provider");
}

export async function streamChat(
  systemInstruction: string,
  history: ChatTurn[],
  signal: AbortSignal,
): Promise<{ stream: ReadableStream<string>; provider: string }> {
  const { value, provider } = await withFallback<ReadableStream<string>>(
    [
      { provider: "Gemini", run: () => streamGemini(systemInstruction, history, signal) },
      ...compatibleProviders().map((config) => ({
        provider: config.label,
        run: () => streamCompatible(config, systemInstruction, history, signal),
      })),
    ],
    signal,
  );
  return { stream: value, provider };
}

export async function generateJson<T>(
  prompt: string,
  responseSchema: object,
  validator: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const { value } = await withFallback<T>(
    [
      { provider: "Gemini", run: () => generateGeminiJson(prompt, responseSchema, validator, signal) },
      ...compatibleProviders().map((config) => ({
        provider: config.label,
        run: () => generateCompatibleJson(config, prompt, responseSchema, validator, signal),
      })),
    ],
    signal,
  );
  return value;
}
