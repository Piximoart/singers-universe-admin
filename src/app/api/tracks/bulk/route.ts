import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeTrackInput } from "@/lib/tracks";

type BulkTrackResult = {
  client_id: string | null;
  slug: string;
  media_url: string;
  reason: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tracks = Array.isArray(body?.tracks) ? body.tracks : [];

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "Prázdný seznam tracků" },
        { status: 400 },
      );
    }

    if (tracks.length > 50) {
      return NextResponse.json(
        { error: "Maximum je 50 tracků najednou" },
        { status: 400 },
      );
    }

    const failed: BulkTrackResult[] = [];
    const skipped: BulkTrackResult[] = [];
    const createdIds: string[] = [];
    const albumSingerCache = new Map<string, string | null>();

    for (const rawTrack of tracks) {
      const { data: normalized, error: normalizeError } = normalizeTrackInput(
        rawTrack as Record<string, unknown>,
      );

      if (!normalized || normalizeError) {
        failed.push({
          client_id: normalized?.client_id ?? null,
          slug: normalized?.slug ?? "",
          media_url: normalized?.media_url ?? "",
          reason: normalizeError ?? "Invalid track payload",
        });
        continue;
      }

      // Album must exist and belong to the same singer.
      if (!albumSingerCache.has(normalized.album_id)) {
        const { data: album, error: albumError } = await supabaseAdmin
          .from("albums")
          .select("id, singer_id")
          .eq("id", normalized.album_id)
          .maybeSingle();

        if (albumError || !album) {
          albumSingerCache.set(normalized.album_id, null);
        } else {
          albumSingerCache.set(normalized.album_id, album.singer_id as string);
        }
      }

      const albumSingerId = albumSingerCache.get(normalized.album_id);
      if (!albumSingerId) {
        failed.push({
          client_id: normalized.client_id,
          slug: normalized.slug,
          media_url: normalized.media_url,
          reason: "Album neexistuje.",
        });
        continue;
      }
      if (albumSingerId !== normalized.singer_id) {
        failed.push({
          client_id: normalized.client_id,
          slug: normalized.slug,
          media_url: normalized.media_url,
          reason: "Album nepatří vybranému zpěvákovi / influencerovi.",
        });
        continue;
      }

      // Idempotency: if same singer + media_url already exists, skip.
      const { data: existingMedia, error: existingMediaError } = await supabaseAdmin
        .from("tracks")
        .select("id")
        .eq("singer_id", normalized.singer_id)
        .eq("media_url", normalized.media_url)
        .maybeSingle();

      if (!existingMediaError && existingMedia) {
        skipped.push({
          client_id: normalized.client_id,
          slug: normalized.slug,
          media_url: normalized.media_url,
          reason: "Track se stejným souborem už existuje.",
        });
        continue;
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("tracks")
        .insert((() => {
          const { client_id: _clientId, ...trackRow } = normalized;
          return trackRow;
        })())
        .select("id")
        .single();

      if (insertError) {
        failed.push({
          client_id: normalized.client_id,
          slug: normalized.slug,
          media_url: normalized.media_url,
          reason: insertError.message,
        });
        continue;
      }

      createdIds.push(inserted.id as string);
    }

    return NextResponse.json(
      {
        ok: true,
        createdCount: createdIds.length,
        createdIds,
        failed,
        skipped,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Bulk insert error:", err);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 },
    );
  }
}
