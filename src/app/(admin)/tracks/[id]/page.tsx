"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";
import AudioUpload from "@/components/AudioUpload";

const MEDIA_TYPES = [
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

interface TrackData {
  singer_id: string;
  album_id: string;
  title: string;
  slug: string;
  media_type: string;
  media_url: string;
  cover_url: string;
  track_number: string;
  duration_seconds: string;
  has_lyrics: boolean;
  lyrics_text: string;
  is_instrumental: boolean;
  is_premium_backstage: boolean;
  is_premium_headliner: boolean;
  released_at: string;
}

export default function EditTrackPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [allAlbums, setAllAlbums] = useState<{ value: string; label: string; singerId: string }[]>([]);
  const [albums, setAlbums] = useState<{ value: string; label: string }[]>([]);

  const [form, setFormState] = useState<TrackData>({
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
      fetch(`/api/tracks/${id}`).then((r) => r.json()),
      fetch("/api/singers").then((r) => r.json()),
      fetch("/api/albums").then((r) => r.json()),
    ]).then(([trackData, s, a]) => {
      if (trackData.track) {
        const t = trackData.track;
        setFormState({
          ...t,
          media_type: t.media_type === "video" ? "video" : "audio",
          track_number: t.track_number?.toString() ?? "",
          duration_seconds: t.duration_seconds?.toString() ?? "",
          album_id: t.album_id ?? "",
          released_at: t.released_at?.slice(0, 10) ?? "",
        });
      }
      setSingers((s.items || []).map((x: { id: string; stage_name: string }) => ({ value: x.id, label: x.stage_name })));
      setAllAlbums((a.items || []).map((x: { id: string; singer_id: string; title: string; singers: { stage_name: string } }) => ({
        value: x.id,
        singerId: x.singer_id,
        label: `${x.title} (${x.singers?.stage_name ?? "?"})`,
      })));
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!form.singer_id) {
      setAlbums([]);
      if (form.album_id) setFormState((prev) => ({ ...prev, album_id: "" }));
      return;
    }

    const filtered = allAlbums
      .filter((album) => album.singerId === form.singer_id)
      .map(({ value, label }) => ({ value, label }));
    setAlbums(filtered);

    if (form.album_id && !filtered.some((a) => a.value === form.album_id)) {
      setFormState((prev) => ({ ...prev, album_id: "" }));
    }
  }, [allAlbums, form.album_id, form.singer_id]);

  function set(key: string, value: string | boolean) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.singer_id.trim()) {
      setError("Vyberte zpěváka / influencera.");
      return;
    }
    if (!form.album_id.trim()) {
      setError("Vyberte album.");
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
        album_id: form.album_id,
        track_number: form.track_number ? Number(form.track_number) : null,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : 0,
        released_at: form.released_at || undefined,
      };
      const res = await fetch(`/api/tracks/${id}`, {
        method: "PUT",
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

  if (loading) return <div className="h-64 flex items-center justify-center text-sub">Načítám...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-md text-sub hover:text-white hover:bg-s2 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Upravit: {form.title}</h1>
          <p className="text-sub text-sm">Editace tracku</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Základní informace</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField type="select" label="Zpěvák / influencer" name="singer_id" value={form.singer_id} onChange={(v) => set("singer_id", v)} options={singers} required />
            <FormField type="select" label="Album" name="album_id" value={form.album_id} onChange={(v) => set("album_id", v)} options={albums} required />
          </div>
          <FormField type="text" label="Název" name="title" value={form.title} onChange={(v) => set("title", v)} required />
          <FormField type="text" label="Slug" name="slug" value={form.slug} onChange={(v) => set("slug", v)} required />
          <div className="grid grid-cols-3 gap-4">
            <FormField type="select" label="Typ média" name="media_type" value={form.media_type} onChange={(v) => set("media_type", v)} options={MEDIA_TYPES} />
            <FormField type="number" label="Číslo tracku" name="track_number" value={form.track_number} onChange={(v) => set("track_number", v)} />
            <FormField type="number" label="Délka (s)" name="duration_seconds" value={form.duration_seconds} onChange={(v) => set("duration_seconds", v)} />
          </div>
          <FormField type="date" label="Datum vydání" name="released_at" value={form.released_at} onChange={(v) => set("released_at", v)} />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Média</h2>
          <AudioUpload
            label="Audio soubor"
            currentUrl={form.media_url}
            onUpload={(url) => set("media_url", url)}
            uploadKey={`${form.media_type === "video" ? "video" : "audio"}/${form.singer_id || "unsorted"}/${form.slug || "track"}.${form.media_type === "video" ? "mp4" : "mp3"}`}
            isPrivate={true}
            uploadEnabled={!!form.singer_id}
            uploadLockReason="Nejdřív vyberte zpěváka / influencera."
            storageBuckets={["private"]}
            storageMediaTypes={form.media_type === "video" ? ["video"] : ["audio"]}
            storagePrefixes={
              form.singer_id
                ? [`${form.media_type === "video" ? "video" : "audio"}/${form.singer_id}/`]
                : []
            }
          />
          <ImageUpload label="Cover obrázek" currentUrl={form.cover_url} onUpload={(url) => set("cover_url", url)} uploadPath={`covers/${form.slug}-cover.jpg`} />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Vlastnosti</h2>
          <div className="grid grid-cols-3 gap-4">
            <FormField type="toggle" label="Má lyrics" name="has_lyrics" value={form.has_lyrics} onChange={(v) => set("has_lyrics", v)} />
            <FormField type="toggle" label="Instrumental" name="is_instrumental" value={form.is_instrumental} onChange={(v) => set("is_instrumental", v)} />
            <FormField type="toggle" label="Backstage only" name="is_premium_backstage" value={form.is_premium_backstage} onChange={(v) => set("is_premium_backstage", v)} />
          </div>
          {form.has_lyrics && (
            <FormField type="textarea" label="Lyrics" name="lyrics_text" value={form.lyrics_text} onChange={(v) => set("lyrics_text", v)} rows={8} />
          )}
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
