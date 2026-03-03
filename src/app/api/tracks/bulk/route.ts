import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { tracks } = await request.json();

    if (!Array.isArray(tracks) || tracks.length === 0) {
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

    const invalidSinger = tracks.find(
      (track) => !track || typeof track.singer_id !== "string" || !track.singer_id.trim(),
    );
    if (invalidSinger) {
      return NextResponse.json(
        { error: "Každý track musí mít vybraného zpěváka / influencera." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tracks")
      .insert(tracks)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, count: data?.length ?? 0 },
      { status: 201 },
    );
  } catch (err) {
    console.error("Bulk insert error:", err);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 },
    );
  }
}
