"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";

interface Story {
  id: string;
  singer_id: string;
  image_url: string;
  caption: string;
  expires_at: string;
  created_at: string;
  singers: { stage_name: string; slug: string } | null;
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    singer_id: "",
    image_url: "",
    caption: "",
    expires_at: "",
  });

  async function load() {
    const [storiesRes, singersRes] = await Promise.all([
      fetch("/api/stories").then((r) => r.json()),
      fetch("/api/singers").then((r) => r.json()),
    ]);
    setStories(storiesRes.items || []);
    setSingers((singersRes.items || []).map((s: { id: string; stage_name: string }) => ({ value: s.id, label: s.stage_name })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tuto story?")) return;
    await fetch(`/api/stories?id=${id}`, { method: "DELETE" });
    setStories((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expires_at: form.expires_at || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");
      setShowForm(false);
      setForm({ singer_id: "", image_url: "", caption: "", expires_at: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stories</h1>
          <p className="text-sub text-sm mt-1">Dočasné stories zpěváků</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-4 py-2 rounded-md hover:bg-white transition-colors"
        >
          <Plus size={16} />
          Přidat
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-s1 border border-border rounded-lg p-5 space-y-4 mb-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-white">Nová story</h2>

          <FormField type="select" label="Zpěvák" name="singer_id" value={form.singer_id} onChange={(v) => set("singer_id", v)} options={singers} required />

          <ImageUpload
            label="Obrázek story"
            onUpload={(url) => set("image_url", url)}
            uploadPath={`stories/${form.singer_id || "singer"}/${Date.now()}.jpg`}
            hint="Doporučeno 9:16 formát pro mobilní zobrazení"
          />

          <FormField type="text" label="Caption (volitelné)" name="caption" value={form.caption} onChange={(v) => set("caption", v)} placeholder="Popis..." />

          <FormField type="date" label="Expiruje (volitelné)" name="expires_at" value={form.expires_at} onChange={(v) => set("expires_at", v)} hint="Pokud nevyplněno, story nevyprší automaticky" />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="bg-lime text-bg text-sm font-semibold px-5 py-2 rounded-md hover:bg-white transition-colors disabled:opacity-50">
              {saving ? "Ukládám..." : "Přidat story"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sub text-sm hover:text-white transition-colors">Zrušit</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-32 flex items-center justify-center text-sub">Načítám...</div>
      ) : stories.length === 0 ? (
        <div className="bg-s1 border border-border rounded-lg p-8 text-center text-sub">
          Žádné stories. Přidejte první!
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {stories.map((story) => (
            <div key={story.id} className="bg-s1 border border-border rounded-lg overflow-hidden group relative">
              <div className="aspect-[9/16] relative bg-s2">
                {story.image_url && (
                  <Image src={story.image_url} alt="story" fill className="object-cover" sizes="200px" />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-white truncate">{story.singers?.stage_name ?? "?"}</p>
                {story.caption && <p className="text-[10px] text-sub truncate mt-0.5">{story.caption}</p>}
                {story.expires_at && <p className="text-[10px] text-sub mt-0.5">Exp: {story.expires_at.slice(0, 10)}</p>}
              </div>
              <button
                onClick={() => handleDelete(story.id)}
                className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
