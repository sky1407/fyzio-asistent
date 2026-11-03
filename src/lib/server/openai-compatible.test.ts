import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { compatibleProviders, createChatCompletionSseParser, toStrictJsonSchema } = await import("./openai-compatible");

function event(content: string | null): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

describe("createChatCompletionSseParser", () => {
  it("joins events split across chunks and ignores [DONE], empty deltas and bad lines", () => {
    const parse = createChatCompletionSseParser();
    const raw = event("Ahoj, ") + event(null) + "data: {zlé\n\n" + event("svet") + "data: [DONE]\n\n";
    const cut = raw.indexOf("svet") - 2;
    expect([...parse(raw.slice(0, cut)), ...parse(raw.slice(cut))]).toEqual(["Ahoj, ", "svet"]);
  });
});

describe("toStrictJsonSchema", () => {
  it("lowercases types and makes every object strict", () => {
    const schema = {
      type: "OBJECT",
      properties: {
        items: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { name: { type: "STRING", description: "Názov" } }, required: [] },
        },
      },
    };
    expect(toStrictJsonSchema(schema)).toEqual({
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string", description: "Názov" } },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    });
  });
});

describe("compatibleProviders", () => {
  it("is empty without an API key", () => {
    expect(compatibleProviders({})).toEqual([]);
  });

  it("configures Groq with low reasoning for gpt-oss models", () => {
    const [groq] = compatibleProviders({ GROQ_API_KEY: " key " });
    expect(groq).toMatchObject({
      label: "Groq",
      apiKey: "key",
      model: "openai/gpt-oss-120b",
      extraBody: { reasoning_effort: "low", include_reasoning: false },
    });
  });

  it("omits reasoning options for other models", () => {
    const [groq] = compatibleProviders({ GROQ_API_KEY: "key", GROQ_MODEL: "llama-3.3-70b-versatile" });
    expect(groq.extraBody).toEqual({});
  });
});
