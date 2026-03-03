"use client";

import { useState, useRef } from "react";
import Image from "next/image";
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
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);

    // Okamžitý lokální preview — nezávisí na serveru
    const localUrl = URL.createObjectURL(file);
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

      URL.revokeObjectURL(localUrl);
      setPreview(data.url);
      onUpload(data.url);
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
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "relative border border-dashed border-border rounded-lg overflow-hidden cursor-pointer transition-colors hover:border-sub",
          loading && "opacity-50 cursor-wait"
        )}
      >
        {preview ? (
          <div className="relative h-40 group">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover"
              sizes="400px"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-sm">Kliknout pro změnu</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
                onUpload("");
              }}
              className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center gap-2 bg-s2">
            {loading ? (
              <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={24} className="text-sub" strokeWidth={1.5} />
                <p className="text-sm text-sub">Přetáhnout nebo kliknout</p>
              </>
            )}
          </div>
        )}
      </div>

      <input
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
