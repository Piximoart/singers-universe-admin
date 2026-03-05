export type RawTrackInput = Record<string, unknown>;

export type NormalizedTrackInput = {
  client_id: string | null;
  singer_id: string;
  album_id: string;
  title: string;
  slug: string;
  media_type: "audio" | "video";
  media_url: string;
  cover_url: string | null;
  track_number: number | null;
  duration_seconds: number;
  has_lyrics: boolean;
  lyrics_text: string | null;
  is_instrumental: boolean;
  is_premium_backstage: boolean;
  is_premium_headliner: boolean;
  released_at: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const v = asString(value);
  return v ? v : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return fallback;
}

export function normalizeTrackInput(raw: RawTrackInput): {
  data: NormalizedTrackInput | null;
  error: string | null;
} {
  const singerId = asString(raw.singer_id);
  const albumId = asString(raw.album_id);
  const title = asString(raw.title);
  const slug = asString(raw.slug);
  const mediaUrl = asString(raw.media_url);
  const mediaTypeRaw = asString(raw.media_type).toLowerCase();

  if (!singerId) return { data: null, error: "Missing singer_id" };
  if (!albumId) return { data: null, error: "Missing album_id" };
  if (!title) return { data: null, error: "Missing title" };
  if (!slug) return { data: null, error: "Missing slug" };
  if (!mediaUrl) return { data: null, error: "Missing media_url" };

  const mediaType = mediaTypeRaw === "video" ? "video" : mediaTypeRaw === "audio" ? "audio" : null;
  if (!mediaType) return { data: null, error: "Invalid media_type" };

  const releasedAtRaw = asString(raw.released_at);
  const releasedAt = releasedAtRaw || new Date().toISOString();

  return {
    data: {
      client_id: asNullableString(raw.client_id),
      singer_id: singerId,
      album_id: albumId,
      title,
      slug,
      media_type: mediaType,
      media_url: mediaUrl,
      cover_url: asNullableString(raw.cover_url),
      track_number:
        raw.track_number === null || raw.track_number === undefined
          ? null
          : asInt(raw.track_number, 0),
      duration_seconds: asInt(raw.duration_seconds, 0),
      has_lyrics: asBoolean(raw.has_lyrics),
      lyrics_text: asNullableString(raw.lyrics_text),
      is_instrumental: asBoolean(raw.is_instrumental),
      is_premium_backstage: asBoolean(raw.is_premium_backstage),
      is_premium_headliner: asBoolean(raw.is_premium_headliner),
      released_at: releasedAt,
    },
    error: null,
  };
}

export function slugFromObjectKey(key: string): string {
  return key
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "track";
}

export function titleFromObjectKey(key: string): string {
  const base = key.split("/").pop()?.replace(/\.[^.]+$/, "") || "Track";
  return base.replace(/[-_]+/g, " ").trim();
}

export function mediaTypeFromObjectKey(key: string): "audio" | "video" {
  return key.startsWith("video/") ? "video" : "audio";
}

export function extFromObjectKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  return ext || "";
}
