"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import DataTable, { Column } from "@/components/DataTable";

interface Track {
  id: string;
  title: string;
  media_type: string;
  duration_seconds: number;
  is_premium_backstage: boolean;
  is_premium_headliner: boolean;
  singers: { stage_name: string } | null;
  albums: { title: string } | null;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const columns: Column<Track>[] = [
  { key: "title", label: "Název" },
  { key: "singers", label: "Zpěvák", render: (r) => r.singers?.stage_name ?? "—" },
  { key: "albums", label: "Album", render: (r) => r.albums?.title ?? "Single" },
  { key: "media_type", label: "Typ" },
  { key: "duration_seconds", label: "Délka", render: (r) => formatDuration(r.duration_seconds) },
  {
    key: "is_premium_backstage",
    label: "Tier",
    render: (r) => {
      if (r.is_premium_headliner) return <span className="text-xs text-yellow-400">Headliner</span>;
      if (r.is_premium_backstage) return <span className="text-xs text-purple-400">Backstage</span>;
      return <span className="text-xs text-sub">Free</span>;
    },
  },
];

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/tracks");
    const data = await res.json();
    setTracks(data.items || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tento track?")) return;
    await fetch(`/api/tracks/${id}`, { method: "DELETE" });
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tracky</h1>
          <p className="text-sub text-sm mt-1">Správa hudebního katalogu</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tracks/bulk" className="flex items-center gap-2 bg-s2 border border-white/10 text-white text-sm font-semibold px-4 py-2 rounded-md hover:border-lime/50 hover:text-lime transition-colors">
            <Upload size={16} />
            Hromadný upload
          </Link>
          <Link href="/tracks/new" className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-4 py-2 rounded-md hover:bg-white transition-colors">
            <Plus size={16} />
            Přidat
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-sub">Načítám...</div>
      ) : (
        <DataTable columns={columns} rows={tracks} editHref={(r) => `/tracks/${r.id}`} onDelete={handleDelete} emptyMessage="Žádné tracky. Přidejte první!" />
      )}
    </div>
  );
}
