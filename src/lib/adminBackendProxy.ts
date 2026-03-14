import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

const DEFAULT_ADMIN_BACKEND_URL = "https://singers-universe-backend.onrender.com";

type ProxyOptions = {
  targetPath?: string;
  requireAuth?: boolean;
};

function getAdminBackendBaseUrl() {
  return (
    process.env.ADMIN_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    DEFAULT_ADMIN_BACKEND_URL
  );
}

function getBridgeToken() {
  return process.env.ADMIN_BRIDGE_TOKEN?.trim() || "";
}

function buildTargetUrl(request: NextRequest, targetPath?: string) {
  const baseUrl = getAdminBackendBaseUrl().replace(/\/+$/, "");
  const path =
    targetPath ??
    request.nextUrl.pathname.replace(/^\/api/, "/v1/admin");
  const query = request.nextUrl.search || "";
  return `${baseUrl}${path}${query}`;
}

function hasRequestBody(method: string) {
  return method !== "GET" && method !== "HEAD";
}

async function forwardRequestToBackend(
  request: NextRequest,
  options: ProxyOptions = {},
): Promise<Response | NextResponse> {
  const bridgeToken = getBridgeToken();
  if (!bridgeToken) {
    return NextResponse.json(
      { error: "Missing ADMIN_BRIDGE_TOKEN" },
      { status: 500 },
    );
  }

  const requireAuth = options.requireAuth ?? true;
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value ?? null;
  if (requireAuth && !sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("x-admin-bridge-token", bridgeToken);

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  const incomingContentType = request.headers.get("content-type");
  if (incomingContentType) {
    headers.set("content-type", incomingContentType);
  }

  const acceptHeader = request.headers.get("accept");
  if (acceptHeader) {
    headers.set("accept", acceptHeader);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    cache: "no-store",
  };

  if (hasRequestBody(method) && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    return await fetch(buildTargetUrl(request, options.targetPath), init);
  } catch {
    return NextResponse.json(
      { error: "Admin backend is unavailable" },
      { status: 502 },
    );
  }
}

export async function proxyAdminRequest(
  request: NextRequest,
  options: ProxyOptions = {},
) {
  const response = await forwardRequestToBackend(request, options);
  if (response instanceof NextResponse) return response;

  const body = await response.arrayBuffer();
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}

export async function requestAdminBackendJson<T>(
  request: NextRequest,
  options: ProxyOptions = {},
): Promise<{ ok: true; response: Response; payload: T } | { ok: false; response: NextResponse }> {
  const response = await forwardRequestToBackend(request, options);
  if (response instanceof NextResponse) return { ok: false, response };

  const payload = (await response.json().catch(() => ({}))) as T;
  return { ok: true, response, payload };
}
