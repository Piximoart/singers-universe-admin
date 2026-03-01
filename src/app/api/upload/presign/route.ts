import { NextRequest, NextResponse } from "next/server";
import { getPresignedPutUrl, getPublicUrl } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const { key, contentType, isPrivate = true } = await request.json();

    if (!key || !contentType) {
      return NextResponse.json(
        { error: "Chybí key nebo contentType" },
        { status: 400 },
      );
    }

    const url = await getPresignedPutUrl(key, contentType, isPrivate);

    // Pro private bucket vrátíme URL bez podpisu jako "finální" URL
    // (bude se přistupovat přes backend stream-url endpoint)
    const publicUrl = isPrivate
      ? `private://${key}` // placeholder — přehrávač použije /v1/tracks/:id/stream-url
      : getPublicUrl(key);

    return NextResponse.json({ url, publicUrl });
  } catch (err) {
    console.error("Presign error:", err);
    return NextResponse.json({ error: "Presign selhal" }, { status: 500 });
  }
}
