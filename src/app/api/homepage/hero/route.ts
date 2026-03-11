import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/apiAuth";
import { extractMediaAssetId, getMediaAssetById, resolveMediaAssetPreviewState } from "@/lib/mediaAssets";
import { supabaseAdmin } from "@/lib/supabase";
import {
  resolveMediaPreviewUrl,
  toMediaObjectKey,
  toMediaReference,
} from "@/lib/storage";

type HeroSlidePayload = {
  id: string;
  kind: "image" | "video";
  headline: string;
  mediaObjectKey: string;
  posterObjectKey?: string;
  ctaHref?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeHeroSlide(value: unknown, index: number): HeroSlidePayload | null {
  if (!isRecord(value)) return null;

  const kind = value.kind === "video" ? "video" : value.kind === "image" ? "image" : null;
  const headline = typeof value.headline === "string" ? value.headline.trim() : "";
  const mediaObjectKey =
    typeof value.mediaObjectKey === "string"
      ? toMediaObjectKey(value.mediaObjectKey, "public")
      : "";
  const posterObjectKey =
    typeof value.posterObjectKey === "string" && value.posterObjectKey.trim()
      ? toMediaObjectKey(value.posterObjectKey, "public")
      : undefined;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const ctaHref =
    typeof value.ctaHref === "string" && value.ctaHref.trim()
      ? value.ctaHref.trim()
      : "/signup";

  if (!kind || !headline || !mediaObjectKey) return null;

  return {
    id: rawId || `hero-slide-${index + 1}`,
    kind,
    headline,
    mediaObjectKey,
    posterObjectKey: kind === "video" ? posterObjectKey : undefined,
    ctaHref,
  };
}

function toDatabaseSlide(slide: HeroSlidePayload) {
  return {
    id: slide.id,
    kind: slide.kind,
    headline: slide.headline,
    mediaBucket: "public",
    mediaObjectKey: slide.mediaObjectKey,
    posterBucket: slide.posterObjectKey ? "public" : undefined,
    posterObjectKey: slide.posterObjectKey,
    ctaHref: slide.ctaHref || "/signup",
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("homepage_featured_slots")
    .select("hero_media_slides")
    .eq("id", "homepage")
    .maybeSingle<{ hero_media_slides: unknown }>();

  if (error) {
    if (error.message.includes("homepage_featured_slots")) {
      return NextResponse.json({
        slides: [],
        setupRequired: true,
        setupMessage:
          "V databázi zatím chybí homepage_featured_slots. Nejprve je potřeba aplikovat homepage migrace.",
      });
    }
    return NextResponse.json(
      { error: "Nepodařilo se načíst homepage hero konfiguraci", details: error.message },
      { status: 500 },
    );
  }

  const rawSlides = Array.isArray(data?.hero_media_slides)
    ? data.hero_media_slides
    : [];

  const slides = await Promise.all(
    rawSlides.flatMap((item, index) => {
      const slide = normalizeHeroSlide(item, index);
      return slide ? [slide] : [];
    }).map(async (slide) => {
      const assetState = await resolveMediaAssetPreviewState(`public://${slide.mediaObjectKey}`);

      return {
        ...slide,
        mediaStoredUrl: toMediaReference(slide.mediaObjectKey, "public"),
        mediaPreviewUrl: assetState?.previewUrl ?? (await resolveMediaPreviewUrl(slide.mediaObjectKey, "public")),
        posterStoredUrl: slide.posterObjectKey
          ? toMediaReference(slide.posterObjectKey, "public")
          : assetState?.posterStoredUrl ?? null,
        posterPreviewUrl: slide.posterObjectKey
          ? await resolveMediaPreviewUrl(slide.posterObjectKey, "public")
          : null,
        mediaStatus: assetState?.status ?? "ready",
        mediaError: assetState?.error ?? null,
      };
    }),
  );

  return NextResponse.json({ slides });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    slides?: unknown;
  } | null;

  if (!body || !Array.isArray(body.slides)) {
    return NextResponse.json(
      { error: "Chybí slides payload" },
      { status: 400 },
    );
  }

  const slides = body.slides.flatMap((item, index) => {
    const slide = normalizeHeroSlide(item, index);
    return slide ? [slide] : [];
  });

  if (slides.length !== body.slides.length) {
    return NextResponse.json(
      { error: "Některé hero slides nejsou validní" },
      { status: 400 },
    );
  }

  for (const slide of slides) {
    const assetId = extractMediaAssetId(`public://${slide.mediaObjectKey}`);
    if (!assetId) continue;

    const asset = await getMediaAssetById(assetId);
    if (!asset) {
      return NextResponse.json(
        { error: `Chybí media asset pro slide ${slide.id}` },
        { status: 400 },
      );
    }

    if (asset.status !== "ready") {
      return NextResponse.json(
        { error: `Slide ${slide.id} ještě není hotový (${asset.status})` },
        { status: 409 },
      );
    }
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("homepage_featured_slots")
    .select("id")
    .eq("id", "homepage")
    .maybeSingle<{ id: string }>();

  if (existingError) {
    if (existingError.message.includes("homepage_featured_slots")) {
      return NextResponse.json(
        {
          error:
            "V databázi zatím chybí homepage_featured_slots. Nejprve je potřeba aplikovat homepage migrace.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Nepodařilo se ověřit homepage konfiguraci", details: existingError.message },
      { status: 500 },
    );
  }

  const payload = {
    hero_media_slides: slides.map(toDatabaseSlide),
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? supabaseAdmin
        .from("homepage_featured_slots")
        .update(payload)
        .eq("id", "homepage")
    : supabaseAdmin
        .from("homepage_featured_slots")
        .insert({
          id: "homepage",
          ...payload,
        });

  const { error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Nepodařilo se uložit homepage hero", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
