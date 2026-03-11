import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { getPresignedPutUrl, getPublicUrl } from "@/lib/storage";
import { validateUploadContentTypeForKey, validateUploadKey } from "@/lib/uploadPolicy";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const { key, contentType, isPrivate = true } = await request.json();

    const keyValidation = validateUploadKey(key);
    if (!keyValidation.ok) {
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 400 },
      );
    }

    const contentTypeValidation = validateUploadContentTypeForKey(
      keyValidation.key,
      contentType,
    );
    if (!contentTypeValidation.ok) {
      return NextResponse.json(
        { error: contentTypeValidation.error },
        { status: 400 },
      );
    }

    const normalizedContentType = (contentType as string).trim().toLowerCase();
    const url = await getPresignedPutUrl(
      keyValidation.key,
      normalizedContentType,
      Boolean(isPrivate),
    );

    // Pro private bucket vrátíme URL bez podpisu jako "finální" URL
    // (bude se přistupovat přes backend stream-url endpoint)
    const publicUrl = Boolean(isPrivate)
      ? `private://${keyValidation.key}` // placeholder — přehrávač použije /v1/tracks/:id/stream-url
      : getPublicUrl(keyValidation.key);

    return NextResponse.json({ url, publicUrl });
  } catch (err) {
    console.error("Presign error:", err);
    return NextResponse.json({ error: "Presign selhal" }, { status: 500 });
  }
}
