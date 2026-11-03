import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionToken } from "@/lib/server/session-token";

const LOGIN_PATH = "/prihlasenie";

export function proxy(request: NextRequest) {
  let authenticated = false;
  try {
    authenticated = isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    authenticated = false;
  }

  const onLoginPage = request.nextUrl.pathname === LOGIN_PATH;
  if (!authenticated && request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Nie ste prihlásená." }, { status: 401 });
  }
  if (!authenticated && !onLoginPage) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  if (authenticated && onLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp|jpg)$).*)"],
};
