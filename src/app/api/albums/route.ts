import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const singerId = request.nextUrl.searchParams.get("singerId")?.trim() || "";

  let query = supabaseAdmin
    .from("albums")
    .select("*, singers(stage_name, slug)")
    .order("release_date", { ascending: false });

  if (singerId) {
    query = query.eq("singer_id", singerId);
  }

  const { data, error } = await query;

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("albums")
    .insert(body)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ album: data }, { status: 201 });
}
