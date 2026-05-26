import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = new Set<string>([
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through API routes:
  //   /api/auth/*  → Better Auth handler (sign-up, sign-in, etc. — must be reachable
  //                  before a session exists, so cannot be protected here).
  //   /api/mcp     → authenticates via Bearer token, not cookies.
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/mcp")) {
    return NextResponse.next();
  }

  const session = getSessionCookie(request);

  // Public path: if logged in, bounce to board.
  if (PUBLIC_PATHS.has(pathname)) {
    if (session && (pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/")) {
      return NextResponse.redirect(new URL("/board", request.url));
    }
    return NextResponse.next();
  }

  // Protected path.
  if (!session) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
