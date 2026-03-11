import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import {
  createMediaAsset,
  createVideoFallbackRef,
  createVideoPosterRef,
  isMediaAssetsSchemaMissingError,
  resolveMediaAssetPreviewState,
} from "@/lib/mediaAssets";
import {
  resolveMediaPreviewUrl,
  toMediaReference,
  uploadMediaBuffer,
} from "@/lib/storage";
import { validateUploadContentTypeForKey, validateUploadKey } from "@/lib/uploadPolicy";

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
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key");
    const isPrivate = normalizeBoolean(formData.get("isPrivate"));

    if (!file || key === null) {
      return NextResponse.json(
        { error: "Chybí soubor nebo key" },
        { status: 400 },
      );
    }

    const keyValidation = validateUploadKey(key);
    if (!keyValidation.ok) {
      return NextResponse.json(
        { error: keyValidation.error },
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
    const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const fallbackContentType = [
      "mp4",
      "mov",
      "webm",
      "avi",
      "mkv",
    ].includes(fileExtension)
      ? "video/mp4"
      : "audio/mpeg";
    const contentType = (file.type || fallbackContentType).toLowerCase();
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

    if (!isPrivate && contentType.startsWith("video/")) {
      try {
        const asset = await createMediaAsset({
          kind: "video",
          fileName: file.name || keyValidation.key,
          contentType,
        });

        await uploadMediaBuffer({
          key: asset.master_object_key,
          buffer,
          contentType,
          bucket: "private",
        });

        const previewUrl = await resolveMediaPreviewUrl(
          `private://${asset.master_object_key}`,
          "private",
        );

        return NextResponse.json({
          storedUrl: createVideoFallbackRef(asset.id),
          mediaUrl: createVideoFallbackRef(asset.id),
          posterStoredUrl: createVideoPosterRef(asset.id),
          previewUrl,
          status: asset.status,
          assetId: asset.id,
        });
      } catch (err) {
        if (!isMediaAssetsSchemaMissingError(err)) {
          throw err;
        }

        const storedUrl = await uploadMediaBuffer({
          key: keyValidation.key,
          buffer,
          contentType,
          bucket: "public",
        });
        const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

        return NextResponse.json({
          storedUrl,
          mediaUrl: storedUrl,
          posterStoredUrl: null,
          previewUrl,
          status: "ready",
          assetId: null,
          pipelineBypassed: true,
        });
      }
    }

    const storedUrl = await uploadMediaBuffer({
      key: keyValidation.key,
      buffer,
      contentType,
      bucket: isPrivate ? "private" : "public",
    });

    const previewUrl = await resolveMediaPreviewUrl(
      storedUrl,
      isPrivate ? "private" : "public",
    );

    return NextResponse.json({
      storedUrl,
      mediaUrl: storedUrl,
      previewUrl,
      status: "ready",
      assetId: null,
    });
  } catch (err) {
    console.error("Media upload error:", err);
    return NextResponse.json({ error: "Upload selhal" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const value = request.nextUrl.searchParams.get("value");
    if (!value?.trim()) {
      return NextResponse.json({ error: "Chybí value" }, { status: 400 });
    }

    let assetState = null;
    try {
      assetState = await resolveMediaAssetPreviewState(value.trim());
    } catch (err) {
      if (!isMediaAssetsSchemaMissingError(err)) {
        throw err;
      }
    }
    if (assetState) {
      return NextResponse.json(assetState);
    }

    const storedUrl = toMediaReference(value, "public");
    const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

    return NextResponse.json({
      storedUrl,
      previewUrl: previewUrl ?? null,
      status: "ready",
      assetId: null,
    });
  } catch (err) {
    console.error("Media resolve error:", err);
    return NextResponse.json(
      { error: "Nepodařilo se připravit preview URL" },
      { status: 500 },
    );
  }
}
