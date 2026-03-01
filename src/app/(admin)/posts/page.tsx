"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import DataTable, { Column } from "@/components/DataTable";

interface Post {
  id: string;
  title: string;
  post_type: string;
  created_at: string;
  singers: { stage_name: string } | null;
}

const columns: Column<Post>[] = [
  { key: "title", label: "Titulek" },
  { key: "singers", label: "Zpěvák", render: (r) => r.singers?.stage_name ?? "—" },
  { key: "post_type", label: "Typ" },
  { key: "created_at", label: "Datum", render: (r) => r.created_at?.slice(0, 10) ?? "—" },
];

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data.items || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tento post?")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Posty</h1>
          <p className="text-sub text-sm mt-1">Feed příspěvky zpěváků</p>
        </div>
        <Link href="/posts/new" className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-4 py-2 rounded-md hover:bg-white transition-colors">
          <Plus size={16} />
          Přidat
        </Link>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-sub">Načítám...</div>
      ) : (
        <DataTable columns={columns} rows={posts} editHref={(r) => `/posts/${r.id}`} onDelete={handleDelete} emptyMessage="Žádné posty. Přidejte první!" />
      )}
    </div>
  );
}
