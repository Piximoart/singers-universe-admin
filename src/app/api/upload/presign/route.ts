import { NextRequest } from "next/server";
import { proxyAdminRequest } from "@/lib/adminBackendProxy";

export async function POST(request: NextRequest) {
  return proxyAdminRequest(request);
}
