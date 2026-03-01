"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import DataTable, { Column } from "@/components/DataTable";

interface Album {
  id: string;
  title: string;
  slug: string;
  release_date: string;
  is_premium_backstage: boolean;
  is_premium_headliner: boolean;
  singers: { stage_name: string } | null;
}

const columns: Column<Album>[] = [
  { key: "title", label: "Název" },
  {
    key: "singers",
    label: "Zpěvák",
    render: (row) => row.singers?.stage_name ?? "—",
  },
  {
    key: "release_date",
    label: "Vydáno",
    render: (row) => row.release_date?.slice(0, 10) ?? "—",
  },
  {
    key: "is_premium_backstage",
    label: "Tier",
    render: (row) => {
      if (row.is_premium_headliner)
        return <span className="text-xs text-yellow-400">Headliner</span>;
      if (row.is_premium_backstage)
        return <span className="text-xs text-purple-400">Backstage</span>;
      return <span className="text-xs text-sub">Free</span>;
    },
  },
];

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/albums");
    const data = await res.json();
    setAlbums(data.items || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat toto album?")) return;
    await fetch(`/api/albums/${id}`, { method: "DELETE" });
    setAlbums((prev) => prev.filter((a) => a.id !== id));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alba</h1>
          <p className="text-sub text-sm mt-1">Správa diskografie</p>
        </div>
        <Link
          href="/albums/new"
          className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-4 py-2 rounded-md hover:bg-white transition-colors"
        >
          <Plus size={16} />
          Přidat
        </Link>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-sub">Načítám...</div>
      ) : (
        <DataTable
          columns={columns}
          rows={albums}
          editHref={(row) => `/albums/${row.id}`}
          onDelete={handleDelete}
          emptyMessage="Žádná alba. Přidejte první!"
        />
      )}
    </div>
  );
}
