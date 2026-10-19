import { NextResponse, type NextRequest } from "next/server";

/** Canonicalize local page visits before rendering, never replay API mutations. */
export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path === "/api" || path.startsWith("/api/") || path.startsWith("/_next/") || path.includes(".")) {
    return NextResponse.next();
  }
  // Next can normalize request.url to localhost. The actual Host identifies the
  // address used by the browser; forwarded headers must not choose a destination.
  const host = request.headers.get("host") ?? "";
  const match = /^(?:127\.0\.0\.1|\[::1\])(?::(\d{1,5}))?$/.exec(host);
  if (!match) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.hostname = "localhost";
  destination.port = match[1] ?? "";
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/|.*\\.).*)"],
};
