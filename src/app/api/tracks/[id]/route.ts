import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeTrackInput } from "@/lib/tracks";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("tracks")
    .select("*, singers(stage_name), albums(title)")
    .eq("id", id)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ track: data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { data: normalized, error: normalizeError } = normalizeTrackInput(
    body as Record<string, unknown>,
  );

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

  const { data: duplicateMedia } = await supabaseAdmin
    .from("tracks")
    .select("id")
    .eq("singer_id", normalized.singer_id)
    .eq("media_url", normalized.media_url)
    .neq("id", id)
    .maybeSingle();
  if (duplicateMedia) {
    return NextResponse.json(
      { error: "Jiný track už používá stejný soubor média." },
      { status: 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("tracks")
    .update((() => {
      const { client_id: _clientId, ...trackRow } = normalized;
      return trackRow;
    })())
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ track: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("tracks").delete().eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
