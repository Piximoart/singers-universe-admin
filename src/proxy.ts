import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthApiRoute =
    pathname === "/api/auth/login" || pathname === "/api/auth/logout";
  const isApiRoute = pathname.startsWith("/api/");

  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login")) return NextResponse.next();

  if (isApiRoute && isAuthApiRoute) return NextResponse.next();

  // Zkontrolovat session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
