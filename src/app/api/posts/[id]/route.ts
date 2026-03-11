import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("*, singers(stage_name)")
    .eq("id", id)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ post: data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("posts")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ post: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
