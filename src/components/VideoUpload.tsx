"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface VideoUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadKey: string;
  hint?: string;
}

export default function VideoUpload({
  label,
  currentUrl,
  onUpload,
  uploadKey,
  hint,
}: VideoUploadProps) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  function openPicker() {
    if (!loading) {
      inputRef.current?.click();
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function resolvePreviewFromStoredValue(value: string) {
      if (value.startsWith("blob:")) {
        setPreview(value);
        return;
      }

      try {
        const res = await fetch(
          `/api/upload/media?value=${encodeURIComponent(value)}`,
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Nepodařilo se načíst preview");
        }

        if (!cancelled) {
          setPreview(
            typeof data.previewUrl === "string" && data.previewUrl
              ? data.previewUrl
              : value,
          );
        }
      } catch {
        if (!cancelled) setPreview(value);
      }
    }

    if (currentUrl?.trim()) {
      resolvePreviewFromStoredValue(currentUrl.trim());
    } else {
      setPreview(null);
    }

    return () => {
      cancelled = true;
    };
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = null;
      }
    };
  }, []);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);

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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload selhal");

      if (localPreviewRef.current === localUrl) {
        URL.revokeObjectURL(localUrl);
        localPreviewRef.current = null;
      }

      const nextPreview =
        typeof data.previewUrl === "string" && data.previewUrl
          ? data.previewUrl
          : null;
      const nextStored =
        typeof data.storedUrl === "string" && data.storedUrl
          ? data.storedUrl
          : "";

      setPreview(nextPreview);
      onUpload(nextStored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload selhal");
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
          <div className="relative aspect-video bg-s2 group">
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
                e.stopPropagation();
                if (localPreviewRef.current) {
                  URL.revokeObjectURL(localPreviewRef.current);
                  localPreviewRef.current = null;
                }
                setPreview(null);
                onUpload("");
              }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              aria-label="Odebrat video"
            >
              <X size={12} />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-3">
              <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">
                Vybrat jiné video
              </span>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 bg-s2"
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
        <button
          type="button"
          onClick={openPicker}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-s3 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-s4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {preview ? "Vybrat jiné video" : "Vybrat video"}
        </button>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {hint && <p className="text-xs text-sub">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
