"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { LOGIN_PATH, endSession, startSession } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/session-token";

export type LoginState = { error: string } | undefined;

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

const LoginSchema = z.object({ password: z.string().min(1).max(200) });

function registerFailure(key: string, now: number): void {
  if (attempts.size > 1000) {
    for (const [ip, entry] of attempts) if (entry.resetAt <= now) attempts.delete(ip);
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: "Zadajte heslo." };

  const requestHeaders = await headers();
  const key = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return { error: "Príliš veľa nesprávnych pokusov. Skúste to znova o 15 minút." };
  }

  try {
    if (!verifyPassword(parsed.data.password)) {
      registerFailure(key, now);
      return { error: "Nesprávne heslo." };
    }
    attempts.delete(key);
    await startSession();
  } catch (error) {
    console.error("Login failed:", error);
    return { error: "Prihlásenie nie je nastavené. Spustite príkaz npm run set-password." };
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect(LOGIN_PATH);
}
