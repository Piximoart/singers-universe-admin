import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

type AdminSession = {
  username: string;
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

  const session = await verifySession(token);
  if (!session || session.role !== "admin") {
    return { ok: false, response: unauthorizedResponse() };
  }

  return { ok: true, session };
}
