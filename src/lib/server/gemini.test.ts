import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createSseTextParser } = await import("./gemini");

function event(parts: object[]): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts } }] })}\r\n\r\n`;
}

describe("createSseTextParser", () => {
  it("joins an event split across several network chunks", () => {
    const parse = createSseTextParser();
    const raw = event([{ text: "Ahoj, " }]) + event([{ text: "svet" }]);
    const cut = raw.indexOf("svet") - 3;
    expect([...parse(raw.slice(0, cut)), ...parse(raw.slice(cut))]).toEqual(["Ahoj, ", "svet"]);
  });

  it("skips thought parts, empty parts and malformed lines", () => {
    const parse = createSseTextParser();
    const raw = event([{ text: "skryté", thought: true }, { text: "" }, { thoughtSignature: "x" }]) + "data: {nie json\n\n" + event([{ text: "OK" }]);
    expect(parse(raw)).toEqual(["OK"]);
  });

  it("waits for the end of a line before parsing", () => {
    const parse = createSseTextParser();
    const raw = event([{ text: "celé" }]);
    expect(parse(raw.slice(0, 20))).toEqual([]);
    expect(parse(raw.slice(20))).toEqual(["celé"]);
  });
});
