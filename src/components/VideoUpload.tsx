"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import { cn } from "@/lib/cn";

type UploadAssetStatus = "processing" | "ready" | "failed";

type UploadState = {
  assetId: string | null;
  status: UploadAssetStatus;
  error?: string | null;
  posterStoredUrl?: string | null;
};

type UploadApiResponse = {
  storedUrl?: string;
  previewUrl?: string | null;
  status?: UploadAssetStatus;
  assetId?: string | null;
  posterStoredUrl?: string | null;
  error?: string;
};

interface VideoUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadKey: string;
  hint?: string;
  onUploadStateChange?: (state: UploadState) => void;
}

export default function VideoUpload({
  label,
  currentUrl,
  onUpload,
  uploadKey,
  hint,
  onUploadStateChange,
}: VideoUploadProps) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<UploadAssetStatus>("ready");
  const localPreviewRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  function publishState(nextStatus: UploadAssetStatus, assetId: string | null, nextError?: string | null, posterStoredUrl?: string | null) {
    setStatus(nextStatus);
    onUploadStateChange?.({
      status: nextStatus,
      assetId,
      error: nextError ?? null,
      posterStoredUrl: posterStoredUrl ?? null,
    });
  }

  function clearPoll() {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearPoll();
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolvePreviewFromStoredValue(value: string) {
      try {
        const res = await fetch(`/api/upload/media?value=${encodeURIComponent(value)}`);
        const data = (await res.json()) as UploadApiResponse;

        if (!res.ok) {
          throw new Error(data.error || "Nepodařilo se načíst preview");
        }

        if (cancelled) return;

        setPreview(typeof data.previewUrl === "string" && data.previewUrl ? data.previewUrl : value);
        publishState(data.status ?? "ready", data.assetId ?? null, data.error ?? null, data.posterStoredUrl ?? null);

        if (data.status === "processing") {
          clearPoll();
          pollTimerRef.current = window.setTimeout(() => {
            void resolvePreviewFromStoredValue(value);
          }, 2500);
        }
      } catch {
        if (!cancelled) {
          setPreview(value);
          publishState("failed", null, "Nepodařilo se načíst preview", null);
        }
      }
    }

    clearPoll();

    if (currentUrl?.trim()) {
      void resolvePreviewFromStoredValue(currentUrl.trim());
    } else {
      setPreview(null);
      publishState("ready", null, null, null);
    }

    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [currentUrl]);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    publishState("processing", null, null, null);

    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }

    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setPreview(localUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", uploadKey);
      formData.append("isPrivate", "false");

      const res = await fetch("/api/upload/media", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as UploadApiResponse;
      if (!res.ok) throw new Error(data.error || "Upload selhal");

      const storedUrl = typeof data.storedUrl === "string" ? data.storedUrl : "";
      if (!storedUrl) throw new Error("Upload nevrátil storedUrl");

      onUpload(storedUrl);

      if (localPreviewRef.current === localUrl) {
        URL.revokeObjectURL(localUrl);
        localPreviewRef.current = null;
      }

      setPreview(typeof data.previewUrl === "string" && data.previewUrl ? data.previewUrl : null);
      publishState(data.status ?? "ready", data.assetId ?? null, data.error ?? null, data.posterStoredUrl ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload selhal";
      setError(message);
      publishState("failed", null, message, null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>

      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-dashed border-border transition-colors hover:border-sub",
          loading && "opacity-50 cursor-wait",
        )}
      >
        {preview ? (
          <label htmlFor={inputId} className={cn("relative block aspect-video bg-s2 group", loading && "cursor-wait")}>
            <video
              src={preview}
              muted
              playsInline
              className="pointer-events-none h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-white text-sm">Kliknout pro změnu videa</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (localPreviewRef.current) {
                  URL.revokeObjectURL(localPreviewRef.current);
                  localPreviewRef.current = null;
                }
                clearPoll();
                setPreview(null);
                publishState("ready", null, null, null);
                onUpload("");
              }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              aria-label="Odebrat video"
            >
              <X size={12} />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start gap-2 p-3">
              <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">
                Preview
              </span>
              {status === "processing" ? (
                <span className="rounded-full bg-amber-500/85 px-3 py-1 text-xs font-medium text-black">
                  Processing
                </span>
              ) : null}
            </div>
          </label>
        ) : (
          <label
            htmlFor={inputId}
            onClick={(e) => {
              if (loading) e.preventDefault();
            }}
            className={cn(
              "flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 bg-s2",
              loading && "cursor-wait",
            )}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
            ) : (
              <>
                <Clapperboard size={24} className="text-sub" strokeWidth={1.5} />
                <p className="text-sm text-sub">Kliknout a nahrát video</p>
              </>
            )}
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          onClick={(e) => {
            if (loading) e.preventDefault();
          }}
          className="inline-flex items-center justify-center rounded-md bg-s3 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-s4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50"
          aria-disabled={loading}
        >
          {preview ? "Vybrat jiné video" : "Vybrat video"}
        </label>
      </div>

      <input
        id={inputId}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {hint && <p className="text-xs text-sub">{hint}</p>}
      {status === "processing" ? (
        <p className="text-xs text-amber-300">Zpracovávám fallback MP4, poster a adaptivní stream…</p>
      ) : null}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
