import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const [singers, albums, tracks, posts, users, subscriptions] =
      await Promise.all([
        supabaseAdmin
          .from("singers")
          .select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("albums")
          .select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("tracks")
          .select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("posts")
          .select("id", { count: "exact", head: true }),
        supabaseAdmin.auth.admin.listUsers(),
        supabaseAdmin
          .from("user_subscriptions")
          .select("id", { count: "exact", head: true })
          .neq("tier", "listener"),
      ]);

    return NextResponse.json({
      singers: singers.count ?? 0,
      albums: albums.count ?? 0,
      tracks: tracks.count ?? 0,
      posts: posts.count ?? 0,
      users: users.data?.users?.length ?? 0,
      paidSubscriptions: subscriptions.count ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 },
    );
  }
}
