import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import {
  listStorageObjects,
  resolveMediaPreviewUrl,
  type MediaBucket,
  type StorageMediaType,
} from "@/lib/storage";

const SUPPORTED_MEDIA_TYPES: StorageMediaType[] = ["image", "audio", "video"];
const SUPPORTED_BUCKETS: MediaBucket[] = ["public", "private"];

function parseBuckets(params: URLSearchParams): MediaBucket[] {
  const requested = params
    .getAll("bucket")
    .map((bucket) => bucket.trim())
    .filter((bucket): bucket is MediaBucket =>
      SUPPORTED_BUCKETS.includes(bucket as MediaBucket),
    );
  return requested.length ? requested : [...SUPPORTED_BUCKETS];
}

function parseMediaTypes(params: URLSearchParams): StorageMediaType[] {
  const requested = params
    .getAll("mediaType")
    .map((type) => type.trim())
    .filter((type): type is StorageMediaType =>
      SUPPORTED_MEDIA_TYPES.includes(type as StorageMediaType),
    );
  return requested.length ? requested : [...SUPPORTED_MEDIA_TYPES];
}

function parsePrefixes(params: URLSearchParams): string[] {
  return params
    .getAll("prefix")
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.length > 0);
}

function parseLimit(params: URLSearchParams): number {
  const raw = Number(params.get("limit") ?? "160");
  if (!Number.isFinite(raw)) return 160;
  return Math.min(Math.max(Math.floor(raw), 1), 400);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const buckets = parseBuckets(request.nextUrl.searchParams);
    const mediaTypes = parseMediaTypes(request.nextUrl.searchParams);
    const prefixes = parsePrefixes(request.nextUrl.searchParams);
    const limit = parseLimit(request.nextUrl.searchParams);

    const objects = await listStorageObjects({
      buckets,
      mediaTypes,
      prefixes: prefixes.length ? prefixes : undefined,
      limit,
    });

    const withPreviews = await Promise.all(
      objects.map(async (item) => {
        let previewUrl: string | null = null;

        if (item.mediaType === "image" || item.mediaType === "video") {
          try {
            previewUrl = await resolveMediaPreviewUrl(item.storedUrl, item.bucket);
          } catch {
            previewUrl = null;
          }
        }

        return {
          key: item.key,
          bucket: item.bucket,
          mediaType: item.mediaType,
          size: item.size,
          lastModified: item.lastModified,
          storedUrl: item.storedUrl,
          previewUrl,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      total: withPreviews.length,
      items: withPreviews,
    });
  } catch (error) {
    console.error("Storage object list failed:", error);
    return NextResponse.json(
      { error: "Nepodařilo se načíst soubory z úložiště." },
      { status: 500 },
    );
  }
}
