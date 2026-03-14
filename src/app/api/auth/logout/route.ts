import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { proxyAdminRequest } from "@/lib/adminBackendProxy";

export async function POST(request: NextRequest) {
  const proxied = await proxyAdminRequest(request, {
    targetPath: "/v1/admin/auth/logout",
  });
  const response = NextResponse.json(
    proxied.ok ? { ok: true } : { error: "Logout failed" },
    { status: proxied.status },
  );
  response.cookies.delete(COOKIE_NAME);
  return response;
}
