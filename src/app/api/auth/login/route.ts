import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { requestAdminBackendJson } from "@/lib/adminBackendProxy";

export async function POST(request: NextRequest) {
  const result = await requestAdminBackendJson<{
    ok?: boolean;
    token?: string;
    error?: string;
  }>(request, { targetPath: "/v1/admin/auth/login", requireAuth: false });

  if (!result.ok) return result.response;

  if (!result.response.ok) {
    return NextResponse.json(
      { error: result.payload.error ?? "Invalid credentials" },
      { status: result.response.status },
    );
  }

  const token = typeof result.payload.token === "string" ? result.payload.token : "";
  if (!token) {
    return NextResponse.json(
      { error: "Missing admin token" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return response;
}
