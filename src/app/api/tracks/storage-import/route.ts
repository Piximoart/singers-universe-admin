import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { listSingerStorageObjects } from "@/lib/storage";
import {
  mediaTypeFromObjectKey,
  normalizeTrackInput,
  slugFromObjectKey,
  titleFromObjectKey,
} from "@/lib/tracks";

type ImportItemInput = {
  key?: string;
  title?: string;
  slug?: string;
  media_type?: "audio" | "video";
};

function startsWithSingerPrefix(key: string, singerId: string): boolean {
  return (
    key.startsWith(`audio/${singerId}/`) || key.startsWith(`video/${singerId}/`)
  );
}

function makeUniqueSlug(rawSlug: string, usedSlugs: Set<string>): string {
  const base = rawSlug || "track";
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  let i = 2;
  while (usedSlugs.has(`${base}-${i}`)) i += 1;
  const resolved = `${base}-${i}`;
  usedSlugs.add(resolved);
  return resolved;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const singerId = request.nextUrl.searchParams.get("singerId")?.trim() || "";
  if (!singerId) {
    return NextResponse.json({ error: "Missing singerId" }, { status: 400 });
  }

  try {
    const [objects, existingTracksRes] = await Promise.all([
      listSingerStorageObjects(singerId),
      supabaseAdmin
        .from("tracks")
        .select("id, media_url, slug, title")
        .eq("singer_id", singerId),
    ]);

    if (existingTracksRes.error) {
      return NextResponse.json(
        { error: existingTracksRes.error.message },
        { status: 500 },
      );
    }

    const existingByMedia = new Map<string, { id: string; slug: string; title: string }>();
    for (const row of existingTracksRes.data ?? []) {
      if (!row.media_url) continue;
      existingByMedia.set(String(row.media_url), {
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
      });
    }

    const items = objects.map((obj) => {
      const existing = existingByMedia.get(obj.storedUrl) ?? null;
      return {
        key: obj.key,
        storedUrl: obj.storedUrl,
        media_type: obj.mediaType,
        size: obj.size,
        lastModified: obj.lastModified,
        suggested_title: titleFromObjectKey(obj.key),
        suggested_slug: slugFromObjectKey(obj.key),
        existsInDb: !!existing,
        existingTrackId: existing?.id ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      total: items.length,
      items,
    });
  } catch (error) {
    console.error("Storage import preview failed:", error);
    return NextResponse.json(
      { error: "Nepodařilo se načíst soubory ze storage." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const singerId = typeof body?.singerId === "string" ? body.singerId.trim() : "";
    const albumId = typeof body?.albumId === "string" ? body.albumId.trim() : "";
    const items = Array.isArray(body?.items) ? (body.items as ImportItemInput[]) : [];

    if (!singerId) {
      return NextResponse.json({ error: "Missing singerId" }, { status: 400 });
    }
    if (!albumId) {
      return NextResponse.json({ error: "Missing albumId" }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Prázdný seznam položek" }, { status: 400 });
    }

    const { data: album, error: albumError } = await supabaseAdmin
      .from("albums")
      .select("id, singer_id")
      .eq("id", albumId)
      .maybeSingle();

    if (albumError || !album) {
      return NextResponse.json({ error: "Album neexistuje." }, { status: 400 });
    }
    if ((album.singer_id as string) !== singerId) {
      return NextResponse.json(
        { error: "Album nepatří vybranému zpěvákovi / influencerovi." },
        { status: 400 },
      );
    }

    const { data: existingTracks, error: existingError } = await supabaseAdmin
      .from("tracks")
      .select("id, media_url, slug")
      .eq("singer_id", singerId);
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const usedSlugs = new Set<string>((existingTracks ?? []).map((x) => String(x.slug)));
    const existingMedia = new Set<string>(
      (existingTracks ?? []).map((x) => String(x.media_url)),
    );

    const skipped: Array<{ key: string; reason: string }> = [];
    const failed: Array<{ key: string; reason: string }> = [];
    const created: Array<{ id: string; key: string; slug: string }> = [];

    for (const item of items) {
      const key = typeof item.key === "string" ? item.key.trim().replace(/^\/+/, "") : "";
      if (!key) {
        failed.push({ key: "", reason: "Missing object key" });
        continue;
      }
      if (!startsWithSingerPrefix(key, singerId)) {
        failed.push({
          key,
          reason: "Soubor nepatří vybranému zpěvákovi / influencerovi.",
        });
        continue;
      }

      const mediaUrl = `private://${key}`;
      if (existingMedia.has(mediaUrl)) {
        skipped.push({ key, reason: "Track se stejným souborem už existuje." });
        continue;
      }

      const rawSlug = (item.slug || slugFromObjectKey(key)).trim();
      const uniqueSlug = makeUniqueSlug(rawSlug, usedSlugs);
      const title = (item.title || titleFromObjectKey(key)).trim() || "Track";
      const mediaType = item.media_type || mediaTypeFromObjectKey(key);

      const { data: normalized, error: normalizeError } = normalizeTrackInput({
        singer_id: singerId,
        album_id: albumId,
        title,
        slug: uniqueSlug,
        media_type: mediaType,
        media_url: mediaUrl,
        cover_url: null,
        track_number: null,
        duration_seconds: 0,
        has_lyrics: false,
        lyrics_text: "",
        is_instrumental: false,
        is_premium_backstage: false,
        is_premium_headliner: false,
      });

      if (!normalized || normalizeError) {
        failed.push({
          key,
          reason: normalizeError ?? "Neplatná data tracku",
        });
        continue;
      }

      const { client_id: _clientId, ...trackRow } = normalized;
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("tracks")
        .insert(trackRow)
        .select("id")
        .single();
      if (insertError) {
        failed.push({ key, reason: insertError.message });
        continue;
      }

      existingMedia.add(mediaUrl);
      created.push({
        id: String(inserted.id),
        key,
        slug: uniqueSlug,
      });
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      created,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("Storage import failed:", error);
    return NextResponse.json(
      { error: "Import ze storage selhal." },
      { status: 500 },
    );
  }
}
