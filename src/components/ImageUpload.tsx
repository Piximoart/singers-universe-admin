"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";

type UploadAssetStatus = "processing" | "ready" | "failed";

type UploadState = {
  assetId: string | null;
  status: UploadAssetStatus;
  error?: string | null;
};

interface ImageUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadPath: string;
  accept?: string;
  hint?: string;
  onUploadStateChange?: (state: UploadState) => void;
}

type UploadApiResponse = {
  storedUrl?: string;
  previewUrl?: string | null;
  status?: UploadAssetStatus;
  assetId?: string | null;
  error?: string;
};

export default function ImageUpload({
  label,
  currentUrl,
  onUpload,
  uploadPath,
  accept = "image/*",
  hint,
  onUploadStateChange,
}: ImageUploadProps) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<UploadAssetStatus>("ready");
  const localPreviewRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  function publishState(nextStatus: UploadAssetStatus, assetId: string | null, nextError?: string | null) {
    setStatus(nextStatus);
    onUploadStateChange?.({ status: nextStatus, assetId, error: nextError ?? null });
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
        const res = await fetch(`/api/upload/image?value=${encodeURIComponent(value)}`);
        const data = (await res.json()) as UploadApiResponse;

        if (!res.ok) {
          throw new Error(data.error || "Nepodařilo se načíst preview");
        }

        if (cancelled) return;

        setPreview(typeof data.previewUrl === "string" && data.previewUrl ? data.previewUrl : value);
        publishState(data.status ?? "ready", data.assetId ?? null, data.error ?? null);

        if (data.status === "processing") {
          clearPoll();
          pollTimerRef.current = window.setTimeout(() => {
            void resolvePreviewFromStoredValue(value);
          }, 2000);
        }
      } catch {
        if (!cancelled) {
          setPreview(value);
          publishState("failed", null, "Nepodařilo se načíst preview");
        }
      }
    }

    clearPoll();

    if (currentUrl?.trim()) {
      void resolvePreviewFromStoredValue(currentUrl.trim());
    } else {
      setPreview(null);
      publishState("ready", null, null);
    }

    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [currentUrl]);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    publishState("processing", null, null);

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
      formData.append("key", uploadPath);

      const res = await fetch("/api/upload/image", {
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
      publishState(data.status ?? "ready", data.assetId ?? null, data.error ?? null);

      if (data.status === "processing") {
        clearPoll();
        pollTimerRef.current = window.setTimeout(() => {
          void fetch(`/api/upload/image?value=${encodeURIComponent(storedUrl)}`)
            .then((response) => response.json() as Promise<UploadApiResponse>)
            .then((payload) => {
              setPreview(typeof payload.previewUrl === "string" && payload.previewUrl ? payload.previewUrl : null);
              publishState(payload.status ?? "ready", payload.assetId ?? null, payload.error ?? null);
              if (payload.status === "processing") {
                onUpload(storedUrl);
              }
            })
            .catch(() => undefined);
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload selhal");
      publishState("failed", null, err instanceof Error ? err.message : "Upload selhal");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative block w-full overflow-hidden rounded-lg border border-dashed border-border text-left transition-colors hover:border-sub",
          loading && "opacity-50 cursor-wait",
        )}
      >
        {preview ? (
          <label htmlFor={inputId} className={cn("relative block h-40 group", loading && "cursor-wait")}>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-white text-sm">Kliknout pro změnu</p>
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
                publishState("ready", null, null);
                onUpload("");
              }}
              className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              aria-label="Odebrat obrázek"
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
              "flex h-40 cursor-pointer flex-col items-center justify-center gap-2 bg-s2 focus-visible:outline-none",
              loading && "cursor-wait",
            )}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={24} className="text-sub" strokeWidth={1.5} />
                <p className="text-sm text-sub">Přetáhnout nebo kliknout</p>
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
          {preview ? "Vybrat jiný obrázek" : "Vybrat obrázek"}
        </label>
      </div>

      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {hint && <p className="text-xs text-sub">{hint}</p>}
      {status === "processing" ? (
        <p className="text-xs text-amber-300">Zpracovávám optimalizovanou public verzi…</p>
      ) : null}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
