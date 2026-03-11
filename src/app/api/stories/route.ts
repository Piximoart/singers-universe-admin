import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("stories")
    .select("*, singers(stage_name, slug)")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("stories")
    .insert(body)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ story: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Chybí id" }, { status: 400 });

  const { error } = await supabaseAdmin.from("stories").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
