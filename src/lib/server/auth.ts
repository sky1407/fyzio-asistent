import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, isValidSessionToken } from "./session-token";

export const LOGIN_PATH = "/prihlasenie";

export async function startSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const hasSession = cache(async (): Promise<boolean> => {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return isValidSessionToken(token);
  } catch (error) {
    console.error("Session verification failed:", error);
    return false;
  }
});

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect(LOGIN_PATH);
}
