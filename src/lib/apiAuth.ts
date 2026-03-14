import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

type AdminSession = {
  username: "admin";
  role: string;
};

type RequireAdminApiSessionResult =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAdminApiSession(
  request: NextRequest,
): Promise<RequireAdminApiSessionResult> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true, session: { username: "admin", role: "admin" } };
}
