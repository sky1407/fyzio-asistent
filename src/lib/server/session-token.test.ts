import { randomBytes, scryptSync } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, createSessionToken, isValidSessionToken, verifyPassword } from "./session-token";

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

describe("session token", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "a".repeat(48);
  });

  it("accepts a freshly created token", () => {
    expect(isValidSessionToken(createSessionToken())).toBe(true);
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const token = createSessionToken(now);
    expect(isValidSessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const [, signature] = createSessionToken().split(".");
    expect(isValidSessionToken(`99999999999.${signature}`)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken();
    process.env.SESSION_SECRET = "b".repeat(48);
    expect(isValidSessionToken(token)).toBe(false);
  });

  it("rejects malformed input", () => {
    for (const value of [undefined, "", "abc", "1.2.3", "x.y", ".sig"]) {
      expect(isValidSessionToken(value)).toBe(false);
    }
  });

  it("throws when the secret is too short", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => createSessionToken()).toThrow();
  });
});

describe("verifyPassword", () => {
  const stored = hashPassword("spravne-heslo");

  it("accepts the correct password", () => {
    expect(verifyPassword("spravne-heslo", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("zle-heslo", stored)).toBe(false);
  });

  it("throws on a missing or malformed hash", () => {
    expect(() => verifyPassword("x", "")).toThrow();
    expect(() => verifyPassword("x", "bcrypt:aa:bb")).toThrow();
  });
});
