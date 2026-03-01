"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import DataTable, { Column } from "@/components/DataTable";

interface Singer {
  id: string;
  stage_name: string;
  slug: string;
  style: string;
  is_active: boolean;
}

const columns: Column<Singer>[] = [
  { key: "stage_name", label: "Jméno" },
  { key: "slug", label: "Slug" },
  { key: "style", label: "Styl" },
  {
    key: "is_active",
    label: "Aktivní",
    render: (row) => (
      <span
        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
          row.is_active
            ? "bg-green-500/15 text-green-400"
            : "bg-s3 text-sub"
        }`}
      >
        {row.is_active ? "Ano" : "Ne"}
      </span>
    ),
  },
];

export default function SingersPage() {
  const [singers, setSingers] = useState<Singer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/singers");
    const data = await res.json();
    setSingers(data.items || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tohoto zpěváka?")) return;
    await fetch(`/api/singers/${id}`, { method: "DELETE" });
    setSingers((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Zpěváci</h1>
          <p className="text-sub text-sm mt-1">Správa AI artistů</p>
        </div>
        <Link
          href="/singers/new"
          className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-4 py-2 rounded-md hover:bg-white transition-colors"
        >
          <Plus size={16} />
          Přidat
        </Link>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-sub">
          Načítám...
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={singers}
          editHref={(row) => `/singers/${row.id}`}
          onDelete={handleDelete}
          emptyMessage="Žádní zpěváci. Přidejte prvního!"
        />
      )}
    </div>
  );
}
