"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";

export default function NewSingerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
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

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/singers", {
        method: "POST",
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
          <h1 className="text-2xl font-bold text-white">Nový zpěvák</h1>
          <p className="text-sub text-sm">Přidejte nového AI artistu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Základní info */}
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Základní informace</h2>

          <FormField
            type="text"
            label="Umělecké jméno"
            name="stage_name"
            value={form.stage_name}
            onChange={(v) => {
              set("stage_name", v);
              if (!form.slug) set("slug", autoSlug(v));
            }}
            required
            placeholder="VEXA"
          />

          <FormField
            type="text"
            label="Slug (URL)"
            name="slug"
            value={form.slug}
            onChange={(v) => set("slug", autoSlug(v))}
            required
            placeholder="vexa"
            hint="Malá písmena, pomlčky. Např: noir-kai"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="text"
              label="Hudební styl"
              name="style"
              value={form.style}
              onChange={(v) => set("style", v)}
              placeholder="Neon pop, cinematic"
            />
            <FormField
              type="text"
              label="Původ / scéna"
              name="origin"
              value={form.origin}
              onChange={(v) => set("origin", v)}
              placeholder="Tokyo, 2030"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="text"
              label="Rok debutu"
              name="debut_year"
              value={form.debut_year}
              onChange={(v) => set("debut_year", v)}
              placeholder="2024"
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
            placeholder="&quot;The void sings back...&quot;"
          />
        </div>

        {/* Biografie */}
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Biografie</h2>

          <FormField
            type="textarea"
            label="Krátký bio"
            name="short_bio"
            value={form.short_bio}
            onChange={(v) => set("short_bio", v)}
            placeholder="Krátký popis pro profil (2-3 věty)..."
            rows={3}
          />

          <FormField
            type="textarea"
            label="Dlouhý příběh"
            name="long_story"
            value={form.long_story}
            onChange={(v) => set("long_story", v)}
            placeholder="Detailní příběh a historia postavy..."
            rows={6}
          />
        </div>

        {/* Média */}
        <div className="bg-s1 border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Média</h2>

          <ImageUpload
            label="Profilová fotografie (avatar)"
            currentUrl={form.avatar_url}
            onUpload={(url) => set("avatar_url", url)}
            uploadPath={`avatars/${form.slug || "singer"}.jpg`}
            hint="Čtvercový obrázek, doporučeno 400×400px"
          />

          <ImageUpload
            label="Cover fotografie (banner)"
            currentUrl={form.cover_url}
            onUpload={(url) => set("cover_url", url)}
            uploadPath={`covers/${form.slug || "singer"}-cover.jpg`}
            hint="Horizontální obrázek, doporučeno 1200×400px"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="color"
              label="Avatar barva"
              name="avatar_hex_color"
              value={form.avatar_hex_color}
              onChange={(v) => set("avatar_hex_color", v)}
              hint="Záložní barva pro gradient pozadí"
            />
            <FormField
              type="color"
              label="Cover barva"
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
            {saving ? "Ukládám..." : "Uložit zpěváka"}
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
