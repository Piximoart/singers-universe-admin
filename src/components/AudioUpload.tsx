"use client";

import { useId, useRef, useState } from "react";
import { Music, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface AudioUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadKey: string; // např. "audio/vexa-neon-lights.mp3"
  isPrivate?: boolean;
  uploadEnabled?: boolean;
  uploadLockReason?: string;
  hint?: string;
}

export default function AudioUpload({
  label,
  currentUrl,
  onUpload,
  uploadKey,
  isPrivate = true,
  uploadEnabled = true,
  uploadLockReason,
  hint,
}: AudioUploadProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(
    currentUrl ? currentUrl.split("/").pop() || null : null
  );
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!currentUrl);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (!loading && uploadEnabled) {
      inputRef.current?.click();
    }
  }

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    setDone(false);
    setProgress(0);
    setFileName(file.name);

    try {
      // Upload přes server-side API (bez CORS problémů z browseru)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const body = new FormData();
        body.append("file", file);
        body.append("key", uploadKey);
        body.append("isPrivate", String(isPrivate));

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
            try {
              const payload = JSON.parse(xhr.responseText) as {
                storedUrl?: string;
                mediaUrl?: string;
              };
              const storedUrl = payload.storedUrl || payload.mediaUrl;
              if (!storedUrl) {
                reject(new Error("Upload nevrátil media URL"));
                return;
              }
              onUpload(storedUrl);
            } catch {
              reject(new Error("Neplatná odpověď upload API"));
              return;
            }
            resolve();
          } else {
            reject(new Error(`Upload selhal: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload selhal")));

        xhr.open("POST", "/api/upload/media");
        xhr.send(body);
      });

      setDone(true);
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
        className={cn(
          "rounded-lg border border-dashed border-border bg-s2 px-4 py-4 transition-colors hover:border-sub",
          loading && "cursor-wait opacity-70",
          !uploadEnabled && "cursor-not-allowed opacity-60"
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
          <label
            htmlFor={inputId}
            className={cn(
              "flex items-center gap-2 text-sm text-sub",
              uploadEnabled && "cursor-pointer",
            )}
          >
            <Music size={16} strokeWidth={1.5} />
            <span>
              {uploadEnabled
                ? "Kliknout a nahrát audio soubor"
                : uploadLockReason || "Nejdřív vyberte zpěváka / influencera"}
            </span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          disabled={loading || !uploadEnabled}
          className="inline-flex items-center justify-center rounded-md bg-s3 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-s4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {done && fileName ? "Vybrat jiné audio" : "Vybrat audio"}
        </button>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/aac,audio/x-m4a,audio/mp4,audio/aiff,audio/x-aiff,audio/opus,video/mp4,video/quicktime,video/webm,audio/*,video/*"
        className="hidden"
        disabled={!uploadEnabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {hint && <p className="text-xs text-sub">{hint}</p>}
      {!uploadEnabled && (
        <p className="text-xs text-red-400">
          {uploadLockReason || "Nejdřív vyberte zpěváka / influencera."}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
