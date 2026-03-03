"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";
import AudioUpload from "@/components/AudioUpload";

const MEDIA_TYPES = [
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

export default function NewTrackPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [albums, setAlbums] = useState<{ value: string; label: string }[]>([]);

  const [form, setForm] = useState({
    singer_id: "",
    album_id: "",
    title: "",
    slug: "",
    media_type: "audio",
    media_url: "",
    cover_url: "",
    track_number: "",
    duration_seconds: "",
    has_lyrics: false,
    lyrics_text: "",
    is_instrumental: false,
    is_premium_backstage: false,
    is_premium_headliner: false,
    released_at: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/singers").then((r) => r.json()),
      fetch("/api/albums").then((r) => r.json()),
    ]).then(([s, a]) => {
      setSingers((s.items || []).map((x: { id: string; stage_name: string }) => ({ value: x.id, label: x.stage_name })));
      setAlbums([
        { value: "", label: "Žádné (single)" },
        ...(a.items || []).map((x: { id: string; title: string; singers: { stage_name: string } }) => ({
          value: x.id,
          label: `${x.title} (${x.singers?.stage_name ?? "?"})`,
        })),
      ]);
    });
  }, []);

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.singer_id.trim()) {
      setError("Vyberte zpěváka / influencera.");
      return;
    }
    if (!form.media_url.trim()) {
      setError("Nahrajte audio nebo video soubor.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        media_type: form.media_type === "video" ? "video" : "audio",
        album_id: form.album_id || null,
        track_number: form.track_number ? Number(form.track_number) : null,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : 0,
        released_at: form.released_at || null,
      };
      const res = await fetch("/api/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");
      router.push("/tracks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-md text-sub hover:text-white hover:bg-s2 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nový track</h1>
          <p className="text-sub text-sm">Přidejte novou skladbu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Základní informace</h2>

          <div className="grid grid-cols-2 gap-4">
            <FormField type="select" label="Zpěvák / influencer" name="singer_id" value={form.singer_id} onChange={(v) => set("singer_id", v)} options={singers} required />
            <FormField type="select" label="Album (volitelné)" name="album_id" value={form.album_id} onChange={(v) => set("album_id", v)} options={albums} />
          </div>

          <FormField
            type="text"
            label="Název tracku"
            name="title"
            value={form.title}
            onChange={(v) => {
              set("title", v);
              if (!form.slug) set("slug", autoSlug(v));
            }}
            required
            placeholder="Neon Lights"
          />

          <FormField type="text" label="Slug (URL)" name="slug" value={form.slug} onChange={(v) => set("slug", autoSlug(v))} required />

          <div className="grid grid-cols-3 gap-4">
            <FormField type="select" label="Typ média" name="media_type" value={form.media_type} onChange={(v) => set("media_type", v)} options={MEDIA_TYPES} />
            <FormField type="number" label="Číslo tracku" name="track_number" value={form.track_number} onChange={(v) => set("track_number", v)} placeholder="1" />
            <FormField type="number" label="Délka (sekundy)" name="duration_seconds" value={form.duration_seconds} onChange={(v) => set("duration_seconds", v)} placeholder="206" />
          </div>

          <FormField type="date" label="Datum vydání" name="released_at" value={form.released_at} onChange={(v) => set("released_at", v)} />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Média</h2>

          <AudioUpload
            label="Audio soubor"
            onUpload={(url) => set("media_url", url)}
            uploadKey={`${form.media_type === "video" ? "video" : "audio"}/${form.singer_id || "unsorted"}/${form.slug || "track"}.${form.media_type === "video" ? "mp4" : "mp3"}`}
            isPrivate={true}
            uploadEnabled={!!form.singer_id}
            uploadLockReason="Nejdřív vyberte zpěváka / influencera."
            hint="MP3/WAV/M4A nebo MP4/MOV/WebM. Nahraje se do privátního storage."
          />

          <ImageUpload
            label="Cover obrázek (volitelné)"
            currentUrl={form.cover_url}
            onUpload={(url) => set("cover_url", url)}
            uploadPath={`covers/${form.slug || "track"}-cover.jpg`}
            hint="Pokud není, použije se cover alba"
          />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Vlastnosti</h2>
          <div className="grid grid-cols-3 gap-4">
            <FormField type="toggle" label="Má lyrics" name="has_lyrics" value={form.has_lyrics} onChange={(v) => set("has_lyrics", v)} />
            <FormField type="toggle" label="Instrumental" name="is_instrumental" value={form.is_instrumental} onChange={(v) => set("is_instrumental", v)} />
            <FormField type="toggle" label="Backstage only" name="is_premium_backstage" value={form.is_premium_backstage} onChange={(v) => set("is_premium_backstage", v)} />
          </div>

          {form.has_lyrics && (
            <FormField type="textarea" label="Text písně (lyrics)" name="lyrics_text" value={form.lyrics_text} onChange={(v) => set("lyrics_text", v)} rows={8} placeholder="[Verse 1]&#10;..." />
          )}
        </div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="bg-lime text-bg text-sm font-semibold px-6 py-2.5 rounded-md hover:bg-white transition-colors disabled:opacity-50">
            {saving ? "Ukládám..." : "Uložit track"}
          </button>
          <button type="button" onClick={() => router.back()} className="text-sub text-sm hover:text-white transition-colors">Zrušit</button>
        </div>
      </form>
    </div>
  );
}
