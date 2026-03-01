"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";

interface SingerData {
  stage_name: string;
  slug: string;
  short_bio: string;
  long_story: string;
  style: string;
  origin: string;
  debut_year: string;
  quote: string;
  is_active: boolean;
  avatar_url: string;
  cover_url: string;
  avatar_hex_color: string;
  cover_hex_color: string;
}

export default function EditSingerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<SingerData>({
    stage_name: "",
    slug: "",
    short_bio: "",
    long_story: "",
    style: "",
    origin: "",
    debut_year: "",
    quote: "",
    is_active: true,
    avatar_url: "",
    cover_url: "",
    avatar_hex_color: "#C4CDD8",
    cover_hex_color: "#111111",
  });

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/singers/${id}`);
      const data = await res.json();
      if (data.singer) setForm(data.singer);
      setLoading(false);
    }
    load();
  }, [id]);

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/singers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");
      router.push("/singers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-sub">
        Načítám...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-md text-sub hover:text-white hover:bg-s2 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Upravit: {form.stage_name}
          </h1>
          <p className="text-sub text-sm">Editace zpěváka</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Základní informace</h2>

          <FormField
            type="text"
            label="Umělecké jméno"
            name="stage_name"
            value={form.stage_name}
            onChange={(v) => set("stage_name", v)}
            required
          />

          <FormField
            type="text"
            label="Slug (URL)"
            name="slug"
            value={form.slug}
            onChange={(v) => set("slug", v)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="text"
              label="Hudební styl"
              name="style"
              value={form.style}
              onChange={(v) => set("style", v)}
            />
            <FormField
              type="text"
              label="Původ / scéna"
              name="origin"
              value={form.origin}
              onChange={(v) => set("origin", v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="text"
              label="Rok debutu"
              name="debut_year"
              value={form.debut_year}
              onChange={(v) => set("debut_year", v)}
            />
            <FormField
              type="toggle"
              label="Aktivní (viditelný)"
              name="is_active"
              value={form.is_active}
              onChange={(v) => set("is_active", v)}
            />
          </div>

          <FormField
            type="text"
            label="Citát"
            name="quote"
            value={form.quote}
            onChange={(v) => set("quote", v)}
          />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Biografie</h2>

          <FormField
            type="textarea"
            label="Krátký bio"
            name="short_bio"
            value={form.short_bio}
            onChange={(v) => set("short_bio", v)}
            rows={3}
          />

          <FormField
            type="textarea"
            label="Dlouhý příběh"
            name="long_story"
            value={form.long_story}
            onChange={(v) => set("long_story", v)}
            rows={6}
          />
        </div>

        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Média</h2>

          <ImageUpload
            label="Profilová fotografie (avatar)"
            currentUrl={form.avatar_url}
            onUpload={(url) => set("avatar_url", url)}
            uploadPath={`avatars/${form.slug}.jpg`}
          />

          <ImageUpload
            label="Cover fotografie (banner)"
            currentUrl={form.cover_url}
            onUpload={(url) => set("cover_url", url)}
            uploadPath={`covers/${form.slug}-cover.jpg`}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="text"
              label="Avatar barva (hex)"
              name="avatar_hex_color"
              value={form.avatar_hex_color}
              onChange={(v) => set("avatar_hex_color", v)}
            />
            <FormField
              type="text"
              label="Cover barva (hex)"
              name="cover_hex_color"
              value={form.cover_hex_color}
              onChange={(v) => set("cover_hex_color", v)}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-lime text-bg text-sm font-semibold px-6 py-2.5 rounded-md hover:bg-white transition-colors disabled:opacity-50"
          >
            {saving ? "Ukládám..." : "Uložit změny"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sub text-sm hover:text-white transition-colors"
          >
            Zrušit
          </button>
        </div>
      </form>
    </div>
  );
}
