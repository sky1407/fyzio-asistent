import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { AiError } = await import("./ai-common");
const { withFallback } = await import("./llm");

const signal = new AbortController().signal;
const fail = (kind: "config" | "overloaded" | "rate_limited" | "failed") => () => Promise.reject(new AiError(kind, kind));

describe("withFallback", () => {
  it("returns the first provider that succeeds", async () => {
    const result = await withFallback(
      [
        { provider: "Gemini", run: fail("rate_limited") },
        { provider: "Groq", run: () => Promise.resolve("ok") },
      ],
      signal,
    );
    expect(result).toEqual({ value: "ok", provider: "Groq" });
  });

  it("reports the rate limit when every provider fails", async () => {
    await expect(
      withFallback(
        [
          { provider: "Gemini", run: fail("rate_limited") },
          { provider: "Groq", run: fail("config") },
        ],
        signal,
      ),
    ).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("rethrows unexpected errors without trying other providers", async () => {
    const next = vi.fn(() => Promise.resolve("never"));
    await expect(
      withFallback(
        [
          { provider: "Gemini", run: () => Promise.reject(new TypeError("bug")) },
          { provider: "Groq", run: next },
        ],
        signal,
      ),
    ).rejects.toThrow("bug");
    expect(next).not.toHaveBeenCalled();
  });

  it("stops when the request was aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const next = vi.fn(() => Promise.resolve("never"));
    await expect(
      withFallback(
        [
          { provider: "Gemini", run: fail("overloaded") },
          { provider: "Groq", run: next },
        ],
        controller.signal,
      ),
    ).rejects.toMatchObject({ kind: "overloaded" });
    expect(next).not.toHaveBeenCalled();
  });
});
