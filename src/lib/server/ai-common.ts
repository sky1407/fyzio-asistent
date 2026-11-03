import "server-only";

export type ChatTurn = { role: "user" | "model"; content: string };

export type AiErrorKind = "config" | "overloaded" | "rate_limited" | "failed";

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const AI_ERROR_RESPONSES: Record<AiErrorKind, { status: number; message: string }> = {
  config: { status: 500, message: "AI asistent nie je nastavený (chýba API kľúč)." },
  overloaded: { status: 503, message: "AI je momentálne preťažená. Skúste to o chvíľu znova." },
  rate_limited: { status: 429, message: "Denné limity všetkých AI modelov sú vyčerpané. Skúste to neskôr." },
  failed: { status: 502, message: "AI neodpovedala. Skúste to znova." },
};

export const REQUEST_TIMEOUT_MS = 120_000;

export function errorKindFromStatus(status: number): AiErrorKind {
  if (status === 429) return "rate_limited";
  if (status === 503 || status === 500) return "overloaded";
  if (status === 401 || status === 403) return "config";
  return "failed";
}
