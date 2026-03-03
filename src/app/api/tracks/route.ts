import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tracks")
    .select("*, singers(stage_name), albums(title)")
    .order("released_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.singer_id || typeof body.singer_id !== "string" || !body.singer_id.trim()) {
    return NextResponse.json(
      { error: "Track musí mít vybraného zpěváka / influencera." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("tracks")
    .insert(body)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ track: data }, { status: 201 });
}
