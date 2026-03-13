"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { logUploadDiagnostic } from "@/lib/uploadDiagnostics";
import StorageObjectPicker, { type StoragePickerItem } from "@/components/StorageObjectPicker";

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
  uploadEnabled?: boolean;
  uploadLockReason?: string;
  storageEnabled?: boolean;
  storagePrefixes?: string[];
  storageBuckets?: ("public" | "private")[];
  onUploadStateChange?: (state: UploadState) => void;
}

type UploadApiResponse = {
  storedUrl?: string;
  previewUrl?: string | null;
  status?: UploadAssetStatus;
  assetId?: string | null;
  error?: string;
};

type PickerInput = HTMLInputElement & { showPicker?: () => void };

const DEFAULT_UPLOAD_LOCK_REASON = "Nejdřív doplňte povinná pole pro upload.";

export default function ImageUpload({
  label,
  currentUrl,
  onUpload,
  uploadPath,
  accept = "image/*",
  hint,
  uploadEnabled = true,
  uploadLockReason,
  storageEnabled = true,
  storagePrefixes,
  storageBuckets = ["public"],
  onUploadStateChange,
}: ImageUploadProps) {
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

  function openPicker(source: string) {
    logUploadDiagnostic("upload_picker_open_attempt", { component: "ImageUpload", source, label });

    if (loading) {
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "ImageUpload",
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
        component: "ImageUpload",
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
      component: "ImageUpload",
      source: "storage-cta",
      label,
    });

    if (loading) {
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "ImageUpload",
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
        component: "ImageUpload",
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
    setBlockedNotice("");
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

  function clearCurrentUpload() {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    clearPoll();
    setPreview(null);
    setBlockedNotice("");
    setError("");
    publishState("ready", null, null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onUpload("");
    logUploadDiagnostic("upload_removed", { component: "ImageUpload", label });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (loading) return;
    if (!uploadEnabled) {
      const reason = uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON;
      setBlockedNotice(reason);
      logUploadDiagnostic("upload_picker_open_blocked", {
        component: "ImageUpload",
        source: "drop",
        reason,
        label,
      });
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) {
      logUploadDiagnostic("upload_file_selected", {
        component: "ImageUpload",
        source: "drop",
        name: file.name,
        type: file.type,
        size: file.size,
      });
      void handleFile(file);
    }
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
    publishState("ready", null, null);
    onUpload(item.storedUrl);
    setShowStoragePicker(false);
    logUploadDiagnostic("upload_file_selected", {
      component: "ImageUpload",
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
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative block w-full overflow-hidden rounded-lg border border-dashed border-border text-left transition-colors hover:border-sub",
          loading && "opacity-50 cursor-wait",
          !uploadEnabled && "opacity-80 border-amber-400/40",
        )}
      >
        {preview ? (
          <div className={cn("relative block h-40", loading && "cursor-wait")}>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearCurrentUpload();
              }}
              className="absolute top-2 right-2 z-30 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
              aria-label="Odebrat obrázek"
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
              "flex h-40 w-full flex-col items-center justify-center gap-2 bg-s2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/80",
              loading ? "cursor-wait" : uploadEnabled ? "cursor-pointer" : "cursor-not-allowed",
            )}
            aria-disabled={loading || !uploadEnabled}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={24} className="text-sub" strokeWidth={1.5} />
                <p className="text-sm text-sub">
                  {uploadEnabled ? "Přetáhnout nebo kliknout" : uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON}
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
          {preview ? "Nahrát nový obrázek" : "Nahrát nový obrázek"}
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
        accept={accept}
        className="h-0 w-0 opacity-0 absolute pointer-events-none"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            logUploadDiagnostic("upload_file_selected", {
              component: "ImageUpload",
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
      <p className="text-xs text-sub">Nahrát nový obrázek = přímý upload do storage.</p>
      {!uploadEnabled ? (
        <p className="text-xs text-amber-300">{uploadLockReason || DEFAULT_UPLOAD_LOCK_REASON}</p>
      ) : null}
      {blockedNotice ? <p className="text-xs text-amber-300">{blockedNotice}</p> : null}
      {status === "processing" ? (
        <p className="text-xs text-amber-300">Zpracovávám optimalizovanou public verzi…</p>
      ) : null}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <StorageObjectPicker
        open={showStoragePicker}
        title={`${label} — výběr ze storage`}
        mediaTypes={["image"]}
        buckets={storageBuckets}
        prefixes={storagePrefixes}
        onClose={() => setShowStoragePicker(false)}
        onSelect={handleStorageSelect}
      />
    </div>
  );
}
