import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("*, singers(stage_name)")
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
    .from("posts")
    .insert(body)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ post: data }, { status: 201 });
}
