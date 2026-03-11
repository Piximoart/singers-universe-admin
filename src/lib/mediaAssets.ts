import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { getPublicUrl, resolveMediaPreviewUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export type MediaAssetKind = "image" | "video";
export type MediaAssetStatus = "processing" | "ready" | "failed";

type MediaAssetRow = {
  id: string;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  master_bucket: "private" | "public";
  master_object_key: string;
  public_base_path: string;
  original_filename: string | null;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  blur_data_url: string | null;
  thumb_object_key: string | null;
  display_object_key: string | null;
  poster_object_key: string | null;
  fallback_object_key: string | null;
  hls_manifest_object_key: string | null;
  error: string | null;
};

export type MediaAssetPreviewState = {
  assetId: string | null;
  status: MediaAssetStatus | null;
  previewUrl: string | null;
  storedUrl: string;
  posterStoredUrl?: string | null;
  error?: string | null;
};

type PostgrestLikeError = {
  code?: string;
  message?: string;
};

const MEDIA_ASSET_ID_PATTERN =
  /^media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i;

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function ensurePrivateRef(objectKey: string) {
  return `private://${trimSlashes(objectKey)}`;
}

export function extractMediaAssetId(value: string | null | undefined) {
  if (!value) return null;

  const clean = value
    .replace(/^public:\/\//, "")
    .replace(/^private:\/\//, "")
    .replace(/^https?:\/\/[^/]+\//, "");

  const match = clean.match(MEDIA_ASSET_ID_PATTERN);
  return match?.[1] ?? null;
}

function createMasterObjectKey(assetId: string, fileName: string, kind: MediaAssetKind) {
  const extension = extname(fileName).toLowerCase() || (kind === "image" ? ".jpg" : ".mp4");
  return `media-masters/${assetId}/source${extension}`;
}

export function createImageDeliveryRef(assetId: string) {
  return `public://media/${assetId}/display.webp`;
}

export function createImageThumbRef(assetId: string) {
  return `public://media/${assetId}/thumb.webp`;
}

export function createVideoFallbackRef(assetId: string) {
  return `public://media/${assetId}/fallback.mp4`;
}

export function createVideoPosterRef(assetId: string) {
  return `public://media/${assetId}/poster.webp`;
}

export async function createMediaAsset(params: {
  kind: MediaAssetKind;
  fileName: string;
  contentType: string;
}) {
  const assetId = randomUUID();
  const masterObjectKey = createMasterObjectKey(assetId, params.fileName, params.kind);
  const publicBasePath = `media/${assetId}`;

  const { data, error } = await supabaseAdmin
    .from("media_assets")
    .insert({
      id: assetId,
      kind: params.kind,
      status: "processing",
      master_bucket: "private",
      master_object_key: masterObjectKey,
      public_base_path: publicBasePath,
      original_filename: params.fileName,
      content_type: params.contentType,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, kind, status, master_bucket, master_object_key, public_base_path, original_filename, content_type, width, height, duration_seconds, blur_data_url, thumb_object_key, display_object_key, poster_object_key, fallback_object_key, hls_manifest_object_key, error",
    )
    .single<MediaAssetRow>();

  if (error) throw error;
  return data;
}

export async function getMediaAssetById(assetId: string) {
  const { data, error } = await supabaseAdmin
    .from("media_assets")
    .select(
      "id, kind, status, master_bucket, master_object_key, public_base_path, original_filename, content_type, width, height, duration_seconds, blur_data_url, thumb_object_key, display_object_key, poster_object_key, fallback_object_key, hls_manifest_object_key, error",
    )
    .eq("id", assetId)
    .maybeSingle<MediaAssetRow>();

  if (error) throw error;
  return data ?? null;
}

async function createPreviewFromAsset(asset: MediaAssetRow): Promise<MediaAssetPreviewState> {
  const storedUrl =
    asset.kind === "image"
      ? createImageDeliveryRef(asset.id)
      : createVideoFallbackRef(asset.id);

  const posterStoredUrl =
    asset.kind === "video" ? createVideoPosterRef(asset.id) : null;

  if (asset.status === "ready") {
    const previewUrl =
      asset.kind === "image"
        ? getPublicUrl(asset.thumb_object_key || asset.display_object_key || `media/${asset.id}/display.webp`)
        : getPublicUrl(asset.fallback_object_key || `media/${asset.id}/fallback.mp4`);

    return {
      assetId: asset.id,
      status: asset.status,
      previewUrl,
      storedUrl,
      posterStoredUrl,
      error: asset.error,
    };
  }

  const previewUrl = await resolveMediaPreviewUrl(
    ensurePrivateRef(asset.master_object_key),
    "private",
  );

  return {
    assetId: asset.id,
    status: asset.status,
    previewUrl,
    storedUrl,
    posterStoredUrl,
    error: asset.error,
  };
}

export async function resolveMediaAssetPreviewState(
  value: string,
): Promise<MediaAssetPreviewState | null> {
  const assetId = extractMediaAssetId(value);
  if (!assetId) return null;

  const asset = await getMediaAssetById(assetId);
  if (!asset) return null;
  return createPreviewFromAsset(asset);
}

export function isMediaAssetsSchemaMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as PostgrestLikeError;
  return (
    maybeError.code === "PGRST205" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("media_assets")
  );
}
