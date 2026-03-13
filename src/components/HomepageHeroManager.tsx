"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";
import VideoUpload from "@/components/VideoUpload";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type UploadStatus = "processing" | "ready" | "failed";

type HeroSlideDraft = {
  id: string;
  kind: "image" | "video";
  headline: string;
  ctaHref: string;
  mediaObjectKey: string;
  posterObjectKey: string;
  mediaPreviewUrl: string | null;
  posterPreviewUrl: string | null;
  mediaStatus: UploadStatus;
  mediaError: string | null;
};

type LoadHomepageHeroResponse = {
  slides?: Partial<HeroSlideDraft>[];
  setupRequired?: boolean;
  setupMessage?: string;
  error?: string;
};

function toObjectKey(value: string) {
  return value.replace(/^(public|private):\/\//, "").replace(/^\/+/, "");
}

function createDraft(): HeroSlideDraft {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `hero-${Date.now()}`;

  return {
    id,
    kind: "image",
    headline: "",
    ctaHref: "/signup",
    mediaObjectKey: "",
    posterObjectKey: "",
    mediaPreviewUrl: null,
    posterPreviewUrl: null,
    mediaStatus: "ready",
    mediaError: null,
  };
}

function normalizeSlide(raw: Partial<HeroSlideDraft> | undefined): HeroSlideDraft {
  return {
    ...createDraft(),
    ...raw,
    mediaStatus: raw?.mediaStatus ?? "ready",
    mediaError: raw?.mediaError ?? null,
  };
}

export default function HomepageHeroManager() {
  const [slides, setSlides] = useState<HeroSlideDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setupMessage, setSetupMessage] = useState("");

  const hasBlockingMediaState = useMemo(
    () =>
      slides.some(
        (slide) =>
          !slide.mediaObjectKey ||
          slide.mediaStatus === "processing" ||
          slide.mediaStatus === "failed",
      ),
    [slides],
  );

  async function load() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/homepage/hero", { cache: "no-store" });
      const data = (await res.json()) as LoadHomepageHeroResponse;
      if (!res.ok) throw new Error(data.error || "Nepodařilo se načíst hero");
      setSetupMessage(data.setupRequired ? data.setupMessage || "" : "");
      setSlides(Array.isArray(data.slides) ? data.slides.map(normalizeSlide) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se načíst hero");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateSlide(id: string, patch: Partial<HeroSlideDraft>) {
    setSlides((current) =>
      current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    );
    setNotice("");
  }

  function moveSlide(id: string, direction: -1 | 1) {
    setSlides((current) => {
      const index = current.findIndex((slide) => slide.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
    setNotice("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/homepage/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: slides.map((slide) => ({
            id: slide.id,
            kind: slide.kind,
            headline: slide.headline,
            mediaObjectKey: slide.mediaObjectKey,
            posterObjectKey: slide.kind === "video" ? slide.posterObjectKey : undefined,
            ctaHref: slide.ctaHref || "/signup",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");
      setNotice("Homepage hero byl uložen.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Homepage Hero</h1>
          <p className="text-sub text-sm mt-1">
            Správa media carouselu pro veřejný hero. Upload jde přes private master a public delivery assety.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setSlides((current) => [...current, createDraft()])}
          >
            <Plus size={16} />
            Přidat slide
          </Button>
          <Button onClick={save} loading={saving} disabled={hasBlockingMediaState}>
            Uložit hero
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="text-sm text-lime">{notice}</p> : null}
      {setupMessage ? <p className="text-sm text-amber-300">{setupMessage}</p> : null}
      {hasBlockingMediaState && slides.length > 0 ? (
        <p className="text-sm text-amber-300">
          Dokud nejsou všechny assety ve stavu ready, hero nejde uložit.
        </p>
      ) : null}

      {loading ? (
        <Card className="p-6 text-sub">Načítám homepage hero…</Card>
      ) : slides.length === 0 ? (
        <Card className="p-6 text-sub">
          Žádné hero slides zatím nejsou. Přidejte první slide a nahrajte obrázek nebo video.
        </Card>
      ) : (
        <div className="space-y-5">
          {slides.map((slide, index) => (
            <Card key={slide.id} className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-sub">Slide {index + 1}</p>
                  <p className="text-sm text-white mt-1">
                    {slide.kind === "video" ? "Video spotlight" : "Image spotlight"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => moveSlide(slide.id, -1)} disabled={index === 0}>
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => moveSlide(slide.id, 1)}
                    disabled={index === slides.length - 1}
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      setSlides((current) => current.filter((item) => item.id !== slide.id))
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="space-y-4">
                  <FormField
                    type="select"
                    label="Typ média"
                    name={`kind-${slide.id}`}
                    value={slide.kind}
                    onChange={(value) =>
                      updateSlide(slide.id, {
                        kind: value === "video" ? "video" : "image",
                        posterObjectKey: value === "video" ? slide.posterObjectKey : "",
                        posterPreviewUrl: value === "video" ? slide.posterPreviewUrl : null,
                        mediaStatus: "ready",
                        mediaError: null,
                      })
                    }
                    options={[
                      { value: "image", label: "Obrázek" },
                      { value: "video", label: "Video" },
                    ]}
                  />

                  <FormField
                    type="textarea"
                    label="Headline"
                    name={`headline-${slide.id}`}
                    value={slide.headline}
                    onChange={(value) => updateSlide(slide.id, { headline: value })}
                    rows={3}
                    placeholder="Například: Step inside the next stage of Singers Universe."
                  />

                  <FormField
                    type="text"
                    label="CTA href"
                    name={`ctaHref-${slide.id}`}
                    value={slide.ctaHref}
                    onChange={(value) => updateSlide(slide.id, { ctaHref: value })}
                    placeholder="/signup"
                    hint="Veřejný hero je nastavený pro Join now. Typicky tedy /signup."
                  />
                </div>

                <div className="space-y-4">
                  {slide.kind === "video" ? (
                    <>
                      <VideoUpload
                        label="Hero video"
                        currentUrl={slide.mediaObjectKey ? `public://${slide.mediaObjectKey}` : ""}
                        uploadKey={`homepage/hero/${slide.id}/media-${Date.now()}.mp4`}
                        onUpload={(value) =>
                          updateSlide(slide.id, {
                            mediaObjectKey: toObjectKey(value),
                            mediaPreviewUrl: null,
                          })
                        }
                        onUploadStateChange={(state) =>
                          updateSlide(slide.id, {
                            mediaStatus: state.status,
                            mediaError: state.error ?? null,
                            posterObjectKey: state.posterStoredUrl
                              ? toObjectKey(state.posterStoredUrl)
                              : slide.posterObjectKey,
                          })
                        }
                        hint="Video se nahraje jako private master. Backend z něj připraví poster, fallback MP4 a adaptivní stream."
                      />
                      {!slide.mediaObjectKey ? (
                        <p className="text-xs text-sub">Po odebrání média klikněte na Vybrat video pro nový soubor.</p>
                      ) : null}
                      <div className="rounded-lg bg-s2 px-4 py-3 text-xs text-sub">
                        Poster se generuje automaticky z videa. Public hero nikdy nepřehrává originální upload.
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageUpload
                        label="Hero image"
                        currentUrl={slide.mediaObjectKey ? `public://${slide.mediaObjectKey}` : ""}
                        onUpload={(value) =>
                          updateSlide(slide.id, {
                            mediaObjectKey: toObjectKey(value),
                            mediaPreviewUrl: null,
                          })
                        }
                        onUploadStateChange={(state) =>
                          updateSlide(slide.id, {
                            mediaStatus: state.status,
                            mediaError: state.error ?? null,
                          })
                        }
                        uploadPath={`homepage/hero/${slide.id}/image-${Date.now()}.jpg`}
                        hint="Nahraje se private master a worker z něj připraví public display.webp + thumb.webp."
                      />
                      {!slide.mediaObjectKey ? (
                        <p className="text-xs text-sub">Po odebrání obrázku klikněte na Vybrat obrázek pro nový soubor.</p>
                      ) : null}
                    </>
                  )}
                  {slide.mediaError ? <p className="text-xs text-red-400">{slide.mediaError}</p> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
