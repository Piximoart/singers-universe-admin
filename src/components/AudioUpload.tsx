"use client";

import { useState, useRef } from "react";
import { Music, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface AudioUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadKey: string; // např. "audio/vexa-neon-lights.mp3"
  isPrivate?: boolean;
  hint?: string;
}

export default function AudioUpload({
  label,
  currentUrl,
  onUpload,
  uploadKey,
  isPrivate = true,
  hint,
}: AudioUploadProps) {
  const [fileName, setFileName] = useState<string | null>(
    currentUrl ? currentUrl.split("/").pop() || null : null
  );
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!currentUrl);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    setDone(false);
    setProgress(0);
    setFileName(file.name);

    try {
      // 1) Získat presigned PUT URL
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: uploadKey,
          contentType: file.type || "audio/mpeg",
          isPrivate,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || "Presign selhal");

      const { url: presignedUrl, publicUrl } = presignData;

      // 2) Nahrát přímo na S3 s progress barem
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload selhal: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload selhal")));

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
        xhr.send(file);
      });

      setDone(true);
      onUpload(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload selhal");
      setFileName(null);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>

      <div
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "border border-dashed border-border rounded-lg bg-s2 px-4 py-4 cursor-pointer hover:border-sub transition-colors",
          loading && "cursor-wait opacity-70"
        )}
      >
        {loading ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-white">
              <Music size={16} className="text-lime flex-shrink-0" />
              <span className="truncate">{fileName}</span>
              <span className="ml-auto text-sub">{progress}%</span>
            </div>
            <div className="w-full bg-s4 rounded-full h-1.5">
              <div
                className="bg-lime h-1.5 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : done && fileName ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            <span className="text-white truncate">{fileName}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFileName(null);
                setDone(false);
                onUpload("");
              }}
              className="ml-auto text-sub hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-sub">
            <Music size={16} strokeWidth={1.5} />
            <span>Kliknout a nahrát audio soubor</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/aac,audio/x-m4a,audio/mp4,audio/aiff,audio/x-aiff,audio/opus,video/mp4,video/quicktime,video/webm,audio/*,video/*"
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
