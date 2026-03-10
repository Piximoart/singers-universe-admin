import { NextRequest, NextResponse } from "next/server";
import {
  resolveMediaPreviewUrl,
  toMediaReference,
  uploadMediaBuffer,
} from "@/lib/storage";

export const runtime = "nodejs";

const MAX_MEDIA_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB

function isAllowedMedia(file: File): boolean {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    return true;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return [
    "mp3",
    "wav",
    "flac",
    "ogg",
    "aac",
    "m4a",
    "aiff",
    "opus",
    "mp4",
    "mov",
    "webm",
    "avi",
    "mkv",
  ].includes(ext);
}

function normalizeBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return true;
  const v = value.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key") as string | null;
    const isPrivate = normalizeBoolean(formData.get("isPrivate"));

    if (!file || !key?.trim()) {
      return NextResponse.json(
        { error: "Chybí soubor nebo key" },
        { status: 400 },
      );
    }

    if (!isAllowedMedia(file)) {
      return NextResponse.json(
        { error: "Nepodporovaný typ audio/video souboru" },
        { status: 400 },
      );
    }

    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Soubor je příliš velký (max 512 MB)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fallbackContentType = key.startsWith("video/") ? "video/mp4" : "audio/mpeg";
    const storedUrl = await uploadMediaBuffer({
      key: key.trim(),
      buffer,
      contentType: file.type || fallbackContentType,
      bucket: isPrivate ? "private" : "public",
    });

    const previewUrl = await resolveMediaPreviewUrl(
      storedUrl,
      isPrivate ? "private" : "public",
    );

    return NextResponse.json({ storedUrl, mediaUrl: storedUrl, previewUrl });
  } catch (err) {
    console.error("Media upload error:", err);
    return NextResponse.json({ error: "Upload selhal" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const value = request.nextUrl.searchParams.get("value");
    if (!value?.trim()) {
      return NextResponse.json({ error: "Chybí value" }, { status: 400 });
    }

    const storedUrl = toMediaReference(value, "public");
    const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

    return NextResponse.json({ storedUrl, previewUrl: previewUrl ?? null });
  } catch (err) {
    console.error("Media resolve error:", err);
    return NextResponse.json(
      { error: "Nepodařilo se připravit preview URL" },
      { status: 500 },
    );
  }
}
