import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeTrackInput } from "@/lib/tracks";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("tracks")
    .select("*, singers(stage_name), albums(title)")
    .order("released_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { data: normalized, error: normalizeError } = normalizeTrackInput(body as Record<string, unknown>);

  if (!normalized || normalizeError) {
    return NextResponse.json(
      { error: normalizeError ?? "Neplatný payload tracku." },
      { status: 400 },
    );
  }

  const { data: album, error: albumError } = await supabaseAdmin
    .from("albums")
    .select("id, singer_id")
    .eq("id", normalized.album_id)
    .maybeSingle();

  if (albumError || !album) {
    return NextResponse.json({ error: "Album neexistuje." }, { status: 400 });
  }
  if ((album.singer_id as string) !== normalized.singer_id) {
    return NextResponse.json(
      { error: "Album nepatří vybranému zpěvákovi / influencerovi." },
      { status: 400 },
    );
  }

  // Idempotency guard for accidental duplicate submit.
  const { data: existingMedia } = await supabaseAdmin
    .from("tracks")
    .select("id")
    .eq("singer_id", normalized.singer_id)
    .eq("media_url", normalized.media_url)
    .maybeSingle();
  if (existingMedia) {
    return NextResponse.json(
      { error: "Track se stejným souborem už existuje." },
      { status: 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("tracks")
    .insert((() => {
      const { client_id: _clientId, ...trackRow } = normalized;
      return trackRow;
    })())
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ track: data }, { status: 201 });
}
