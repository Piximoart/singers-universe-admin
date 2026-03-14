import { NextRequest } from "next/server";
import { proxyAdminRequest } from "@/lib/adminBackendProxy";

export async function GET(request: NextRequest) {
  return proxyAdminRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyAdminRequest(request);
}
