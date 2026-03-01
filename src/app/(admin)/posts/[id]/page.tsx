"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";

const POST_TYPES = [
  { value: "story", label: "Story" },
  { value: "release", label: "Release" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "announcement", label: "Announcement" },
];

interface PostData {
  singer_id: string;
  post_type: string;
  title: string;
  body: string;
  track_id: string;
  media_url: string;
}

export default function EditPostPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [tracks, setTracks] = useState<{ value: string; label: string }[]>([]);

  const [form, setFormState] = useState<PostData>({
    singer_id: "",
    post_type: "announcement",
    title: "",
    body: "",
    track_id: "",
    media_url: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/posts/${id}`).then((r) => r.json()),
      fetch("/api/singers").then((r) => r.json()),
      fetch("/api/tracks").then((r) => r.json()),
    ]).then(([postData, s, t]) => {
      if (postData.post) setFormState({ ...postData.post, track_id: postData.post.track_id ?? "" });
      setSingers((s.items || []).map((x: { id: string; stage_name: string }) => ({ value: x.id, label: x.stage_name })));
      setTracks([
        { value: "", label: "Bez tracku" },
        ...(t.items || []).map((x: { id: string; title: string }) => ({ value: x.id, label: x.title })),
      ]);
      setLoading(false);
    });
  }, [id]);

  function set(key: string, value: string) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = { ...form, track_id: form.track_id || null };
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");
      router.push("/posts");
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
          <h1 className="text-2xl font-bold text-white">Upravit post</h1>
          <p className="text-sub text-sm">Editace příspěvku</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Informace</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField type="select" label="Zpěvák" name="singer_id" value={form.singer_id} onChange={(v) => set("singer_id", v)} options={singers} required />
            <FormField type="select" label="Typ postu" name="post_type" value={form.post_type} onChange={(v) => set("post_type", v)} options={POST_TYPES} required />
          </div>
          <FormField type="text" label="Titulek" name="title" value={form.title} onChange={(v) => set("title", v)} />
          <FormField type="textarea" label="Text" name="body" value={form.body} onChange={(v) => set("body", v)} rows={5} />
          <FormField type="select" label="Track" name="track_id" value={form.track_id} onChange={(v) => set("track_id", v)} options={tracks} />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Médium</h2>
          <ImageUpload label="Obrázek" currentUrl={form.media_url} onUpload={(url) => set("media_url", url)} uploadPath={`posts/${id}.jpg`} />
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
