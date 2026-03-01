"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";

interface AlbumData {
  singer_id: string;
  title: string;
  slug: string;
  short_description: string;
  long_description: string;
  release_date: string;
  cover_url: string;
  is_premium_backstage: boolean;
  is_premium_headliner: boolean;
}

export default function EditAlbumPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);

  const [form, setFormState] = useState<AlbumData>({
    singer_id: "",
    title: "",
    slug: "",
    short_description: "",
    long_description: "",
    release_date: "",
    cover_url: "",
    is_premium_backstage: false,
    is_premium_headliner: false,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/albums/${id}`).then((r) => r.json()),
      fetch("/api/singers").then((r) => r.json()),
    ]).then(([albumData, singersData]) => {
      if (albumData.album) setFormState(albumData.album);
      setSingers(
        (singersData.items || []).map((s: { id: string; stage_name: string }) => ({
          value: s.id,
          label: s.stage_name,
        }))
      );
      setLoading(false);
    });
  }, [id]);

  function set(key: string, value: string | boolean) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/albums/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");
      router.push("/albums");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-64 flex items-center justify-center text-sub">Načítám...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-md text-sub hover:text-white hover:bg-s2 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Upravit: {form.title}</h1>
          <p className="text-sub text-sm">Editace alba</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Základní informace</h2>
          <FormField type="select" label="Zpěvák" name="singer_id" value={form.singer_id} onChange={(v) => set("singer_id", v)} options={singers} required />
          <FormField type="text" label="Název alba" name="title" value={form.title} onChange={(v) => set("title", v)} required />
          <FormField type="text" label="Slug (URL)" name="slug" value={form.slug} onChange={(v) => set("slug", v)} required />
          <FormField type="date" label="Datum vydání" name="release_date" value={form.release_date} onChange={(v) => set("release_date", v)} />
          <FormField type="textarea" label="Krátký popis" name="short_description" value={form.short_description} onChange={(v) => set("short_description", v)} rows={2} />
          <FormField type="textarea" label="Dlouhý popis" name="long_description" value={form.long_description} onChange={(v) => set("long_description", v)} rows={4} />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Dostupnost</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField type="toggle" label="Backstage only" name="is_premium_backstage" value={form.is_premium_backstage} onChange={(v) => set("is_premium_backstage", v)} />
            <FormField type="toggle" label="Headliner only" name="is_premium_headliner" value={form.is_premium_headliner} onChange={(v) => set("is_premium_headliner", v)} />
          </div>
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Cover obrázek</h2>
          <ImageUpload label="Album cover" currentUrl={form.cover_url} onUpload={(url) => set("cover_url", url)} uploadPath={`covers/${form.slug}.jpg`} />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="bg-lime text-bg text-sm font-semibold px-6 py-2.5 rounded-md hover:bg-white transition-colors disabled:opacity-50">
            {saving ? "Ukládám..." : "Uložit změny"}
          </button>
          <button type="button" onClick={() => router.back()} className="text-sub text-sm hover:text-white transition-colors">Zrušit</button>
        </div>
      </form>
    </div>
  );
}
