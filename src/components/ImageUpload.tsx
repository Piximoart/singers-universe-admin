"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ImageUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadPath: string; // např. "avatars/vexa.jpg"
  accept?: string;
  hint?: string;
}

export default function ImageUpload({
  label,
  currentUrl,
  onUpload,
  uploadPath,
  accept = "image/*",
  hint,
}: ImageUploadProps) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  function openPicker() {
    if (!loading) inputRef.current?.click();
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
          `/api/upload/image?value=${encodeURIComponent(value)}`,
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

    // Okamžitý lokální preview — nezávisí na serveru
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative block w-full overflow-hidden rounded-lg border border-dashed border-border text-left transition-colors hover:border-sub",
          loading && "opacity-50 cursor-wait"
        )}
      >
        {preview ? (
          <div className="relative h-40 group">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-white text-sm">Kliknout pro změnu</p>
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
              className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              aria-label="Odebrat obrázek"
            >
              <X size={12} />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start p-3">
              <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">
                Preview
              </span>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 bg-s2 focus-visible:outline-none"
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
        <button
          type="button"
          onClick={openPicker}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-s3 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-s4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {preview ? "Vybrat jiný obrázek" : "Vybrat obrázek"}
        </button>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
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
