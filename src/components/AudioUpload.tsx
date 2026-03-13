"use client";

import { useId, useRef, useState } from "react";
import { Music, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { logUploadDiagnostic } from "@/lib/uploadDiagnostics";
import StorageObjectPicker, { type StoragePickerItem } from "@/components/StorageObjectPicker";

interface AudioUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  uploadKey: string;
  isPrivate?: boolean;
  uploadEnabled?: boolean;
  uploadLockReason?: string;
  hint?: string;
  storageEnabled?: boolean;
  storagePrefixes?: string[];
  storageBuckets?: ("public" | "private")[];
  storageMediaTypes?: ("audio" | "video")[];
}

const DEFAULT_UPLOAD_LOCK_REASON = "Nejdřív vyberte zpěváka / influencera.";

export default function AudioUpload({
  label,
  currentUrl,
  onUpload,
  uploadKey,
  isPrivate = true,
  uploadEnabled = true,
  uploadLockReason,
  hint,
  storageEnabled = true,
  storagePrefixes,
  storageBuckets = ["private"],
  storageMediaTypes = ["audio", "video"],
}: AudioUploadProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(
    currentUrl ? currentUrl.split("/").pop() || null : null,
  );
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!currentUrl);
  const [error, setError] = useState("");
  const [blockedNotice, setBlockedNotice] = useState("");
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePickerTrigger(source: string, event?: React.MouseEvent<HTMLElement>) {
    logUploadDiagnostic("picker_attempt", {
      component: "AudioUpload",
      source,
      label,
    });

    if (loading) {
      event?.preventDefault();
      logUploadDiagnostic("picker_blocked", {
        component: "AudioUpload",
        source,
        reason: "loading",
        label,
      });
      return;
    }

    if (!uploadEnabled) {
      event?.preventDefault();
      const reason = uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON;
      setBlockedNotice(reason);
      logUploadDiagnostic("picker_blocked", {
        component: "AudioUpload",
        source,
        reason,
        label,
      });
      return;
    }

    setBlockedNotice("");
    setError("");
    logUploadDiagnostic("picker_opened", {
      component: "AudioUpload",
      source,
      label,
    });
  }

  function openStoragePicker() {
    logUploadDiagnostic("picker_attempt", {
      component: "AudioUpload",
      source: "storage-cta",
      label,
    });

    if (loading) {
      logUploadDiagnostic("picker_blocked", {
        component: "AudioUpload",
        source: "storage-cta",
        reason: "loading",
        label,
      });
      return;
    }

    if (!uploadEnabled) {
      const reason = uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON;
      setBlockedNotice(reason);
      logUploadDiagnostic("picker_blocked", {
        component: "AudioUpload",
        source: "storage-cta",
        reason,
        label,
      });
      return;
    }

    setBlockedNotice("");
    setError("");
    setShowStoragePicker(true);
  }

  async function handleFile(file: File) {
    setBlockedNotice("");
    setError("");
    setLoading(true);
    setDone(false);
    setProgress(0);
    setFileName(file.name);
    logUploadDiagnostic("upload_started", {
      component: "AudioUpload",
      source: "picker",
      label,
      name: file.name,
      type: file.type,
      size: file.size,
    });

    try {
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
              logUploadDiagnostic("upload_done", {
                component: "AudioUpload",
                source: "picker",
                label,
                storedUrl,
              });
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
      logUploadDiagnostic("upload_failed", {
        component: "AudioUpload",
        source: "picker",
        label,
        error: err instanceof Error ? err.message : "Upload selhal",
      });
    } finally {
      setLoading(false);
    }
  }

  function clearCurrentUpload() {
    setFileName(null);
    setDone(false);
    setProgress(0);
    setError("");
    setBlockedNotice("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onUpload("");
    logUploadDiagnostic("upload_removed", { component: "AudioUpload", label });
  }

  function handleStorageSelect(item: StoragePickerItem) {
    setBlockedNotice("");
    setError("");
    setLoading(false);
    setProgress(0);
    setDone(true);
    setFileName(item.key.split("/").pop() || item.key);
    onUpload(item.storedUrl);
    setShowStoragePicker(false);
    logUploadDiagnostic("file_selected", {
      component: "AudioUpload",
      source: "storage-select",
      key: item.key,
      bucket: item.bucket,
      storedUrl: item.storedUrl,
    });
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-white">{label}</label>

      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-s2 px-4 py-4 transition-colors hover:border-sub",
          loading && "cursor-wait opacity-70",
          !uploadEnabled && "cursor-not-allowed opacity-80 border-amber-400/40",
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
                clearCurrentUpload();
              }}
              className="ml-auto text-sub hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            onClick={(event) => handlePickerTrigger("dropzone", event)}
            className={cn(
              "flex items-center gap-2 text-sm text-sub",
              uploadEnabled ? "cursor-pointer" : "cursor-not-allowed",
            )}
            aria-disabled={loading || !uploadEnabled}
          >
            <Music size={16} strokeWidth={1.5} />
            <span>
              {uploadEnabled ? "Kliknout a nahrát audio soubor" : uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON}
            </span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          onClick={(event) => handlePickerTrigger("cta", event)}
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-s3 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-s4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50",
            loading && "cursor-not-allowed opacity-50",
            !uploadEnabled && "border border-amber-400/50 hover:bg-s3",
          )}
          aria-disabled={loading || !uploadEnabled}
        >
          {done && fileName ? "Nahrát nové audio/video" : "Nahrát nové audio/video"}
        </label>
        {storageEnabled ? (
          <button
            type="button"
            onClick={openStoragePicker}
            disabled={loading}
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-white/10 bg-s2 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-lime/50 hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50",
              !uploadEnabled && "border-amber-400/50 hover:text-white",
            )}
            aria-disabled={loading || !uploadEnabled}
          >
            Vybrat z úložiště
          </button>
        ) : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/aac,audio/x-m4a,audio/mp4,audio/aiff,audio/x-aiff,audio/opus,video/mp4,video/quicktime,video/webm,audio/*,video/*"
        className="sr-only"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            logUploadDiagnostic("file_selected", {
              component: "AudioUpload",
              source: "picker",
              name: file.name,
              type: file.type,
              size: file.size,
            });
            void handleFile(file);
          }
          e.target.value = "";
        }}
      />

      {hint && <p className="text-xs text-sub">{hint}</p>}
      <p className="text-xs text-sub">Nahrát nové audio/video = přímý upload do storage.</p>
      {!uploadEnabled && <p className="text-xs text-amber-300">{uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON}</p>}
      {blockedNotice ? <p className="text-xs text-amber-300">{blockedNotice}</p> : null}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <StorageObjectPicker
        open={showStoragePicker}
        title={`${label} — výběr ze storage`}
        mediaTypes={storageMediaTypes}
        buckets={storageBuckets}
        prefixes={storagePrefixes}
        onClose={() => setShowStoragePicker(false)}
        onSelect={handleStorageSelect}
      />
    </div>
  );
}
