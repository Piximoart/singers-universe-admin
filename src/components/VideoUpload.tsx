"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clapperboard, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { logUploadDiagnostic } from "@/lib/uploadDiagnostics";
import StorageObjectPicker, { type StoragePickerItem } from "@/components/StorageObjectPicker";

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
  uploadEnabled?: boolean;
  uploadLockReason?: string;
  storageEnabled?: boolean;
  storagePrefixes?: string[];
  storageBuckets?: ("public" | "private")[];
  onUploadStateChange?: (state: UploadState) => void;
}

type PickerInput = HTMLInputElement & { showPicker?: () => void };

const DEFAULT_UPLOAD_LOCK_REASON = "Nejdřív doplňte povinná pole pro upload.";

export default function VideoUpload({
  label,
  currentUrl,
  onUpload,
  uploadKey,
  hint,
  uploadEnabled = true,
  uploadLockReason,
  storageEnabled = true,
  storagePrefixes,
  storageBuckets = ["public"],
  onUploadStateChange,
}: VideoUploadProps) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<UploadAssetStatus>("ready");
  const [blockedNotice, setBlockedNotice] = useState("");
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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

  function openPicker(source: string) {
    logUploadDiagnostic("upload_picker_open_attempt", { component: "VideoUpload", source, label });

    if (loading) {
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "VideoUpload",
        source,
        reason: "loading",
        label,
      });
      return;
    }

    if (!uploadEnabled) {
      const reason = uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON;
      setBlockedNotice(reason);
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "VideoUpload",
        source,
        reason,
        label,
      });
      return;
    }

    setBlockedNotice("");
    setError("");
    const input = inputRef.current;
    if (!input) return;

    try {
      const pickerInput = input as PickerInput;
      if (typeof pickerInput.showPicker === "function") {
        pickerInput.showPicker();
        return;
      }
      input.click();
    } catch {
      input.click();
    }
  }

  function openStoragePicker() {
    logUploadDiagnostic("upload_picker_open_attempt", {
      component: "VideoUpload",
      source: "storage-cta",
      label,
    });

    if (loading) {
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "VideoUpload",
        source: "storage-cta",
        reason: "loading",
        label,
      });
      return;
    }

    if (!uploadEnabled) {
      const reason = uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON;
      setBlockedNotice(reason);
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "VideoUpload",
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
    setBlockedNotice("");
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

  function clearCurrentUpload() {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    clearPoll();
    setPreview(null);
    setBlockedNotice("");
    setError("");
    publishState("ready", null, null, null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onUpload("");
    logUploadDiagnostic("upload_removed", { component: "VideoUpload", label });
  }

  function handleStorageSelect(item: StoragePickerItem) {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    clearPoll();
    setBlockedNotice("");
    setError("");
    setLoading(false);
    setPreview(item.previewUrl ?? null);
    publishState("ready", null, null, null);
    onUpload(item.storedUrl);
    setShowStoragePicker(false);
    logUploadDiagnostic("upload_file_selected", {
      component: "VideoUpload",
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
          "relative overflow-hidden rounded-lg border border-dashed border-border transition-colors hover:border-sub",
          loading && "opacity-50 cursor-wait",
          !uploadEnabled && "opacity-80 border-amber-400/40",
        )}
      >
        {preview ? (
          <div className={cn("relative block aspect-video bg-s2", loading && "cursor-wait")}>
            <video src={preview} muted playsInline className="pointer-events-none h-full w-full object-cover" />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearCurrentUpload();
              }}
              className="absolute top-2 right-2 z-30 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              aria-label="Odebrat video"
            >
              <X size={12} />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-start gap-2 p-3">
              <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">Preview</span>
              {status === "processing" ? (
                <span className="rounded-full bg-amber-500/85 px-3 py-1 text-xs font-medium text-black">
                  Processing
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openPicker("dropzone")}
            className={cn(
              "flex aspect-video w-full flex-col items-center justify-center gap-2 bg-s2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80",
              loading ? "cursor-wait" : uploadEnabled ? "cursor-pointer" : "cursor-not-allowed",
            )}
            aria-disabled={loading || !uploadEnabled}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
            ) : (
              <>
                <Clapperboard size={24} className="text-sub" strokeWidth={1.5} />
                <p className="text-sm text-sub">
                  {uploadEnabled ? "Kliknout a nahrát video" : uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON}
                </p>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openPicker("cta")}
          disabled={loading}
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-s3 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-s4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80 disabled:cursor-not-allowed disabled:opacity-50",
            !uploadEnabled && "border border-amber-400/50 hover:bg-s3",
          )}
          aria-disabled={loading || !uploadEnabled}
        >
          {preview ? "Nahrát nové video" : "Nahrát nové video"}
        </button>
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
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="h-0 w-0 opacity-0 absolute pointer-events-none"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            logUploadDiagnostic("upload_file_selected", {
              component: "VideoUpload",
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
      <p className="text-xs text-sub">Nahrát nové video = přímý upload do storage.</p>
      {!uploadEnabled ? (
        <p className="text-xs text-amber-300">{uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON}</p>
      ) : null}
      {blockedNotice ? <p className="text-xs text-amber-300">{blockedNotice}</p> : null}
      {status === "processing" ? (
        <p className="text-xs text-amber-300">Zpracovávám fallback MP4, poster a adaptivní stream…</p>
      ) : null}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <StorageObjectPicker
        open={showStoragePicker}
        title={`${label} — výběr ze storage`}
        mediaTypes={["video"]}
        buckets={storageBuckets}
        prefixes={storagePrefixes}
        onClose={() => setShowStoragePicker(false)}
        onSelect={handleStorageSelect}
      />
    </div>
  );
}
