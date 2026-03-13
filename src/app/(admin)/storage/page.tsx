"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { logUploadDiagnostic } from "@/lib/uploadDiagnostics";
import { safeOpenFileDialog } from "@/lib/safeOpenFileDialog";

type Bucket = "public" | "private";
type MediaType = "image" | "audio" | "video";

type StorageItem = {
  key: string;
  bucket: Bucket;
  mediaType: MediaType | "unknown";
  size: number;
  lastModified: string | null;
  storedUrl: string;
  previewUrl: string | null;
};

type PrefixOption = { value: string; label: string };

const PREFIX_OPTIONS: Record<MediaType, PrefixOption[]> = {
  image: [
    { value: "homepage/hero", label: "homepage/hero" },
    { value: "posts", label: "posts" },
    { value: "stories", label: "stories" },
    { value: "covers", label: "covers" },
    { value: "avatars", label: "avatars" },
  ],
  video: [
    { value: "homepage/hero", label: "homepage/hero" },
    { value: "video", label: "video" },
  ],
  audio: [
    { value: "audio", label: "audio" },
  ],
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function toSafeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";

  const safeBase = base
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeBase || "file"}${ext}`;
}

function createObjectKey(prefix: string, fileName: string) {
  const safePrefix = trimSlashes(prefix);
  const safeName = toSafeFileName(fileName);
  return safePrefix
    ? `${safePrefix}/${Date.now()}-${safeName}`
    : `${Date.now()}-${safeName}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return "Neznámé datum";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neznámé datum";
  return date.toLocaleString("cs-CZ");
}

export default function StoragePage() {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [bucketFilter, setBucketFilter] = useState<"all" | Bucket>("all");
  const [mediaFilter, setMediaFilter] = useState<"all" | MediaType>("all");
  const [prefixFilter, setPrefixFilter] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(240);

  const [uploadType, setUploadType] = useState<MediaType>("image");
  const [uploadBucket, setUploadBucket] = useState<Bucket>("public");
  const [uploadPrefix, setUploadPrefix] = useState(PREFIX_OPTIONS.image[0].value);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUploadPrefix(PREFIX_OPTIONS[uploadType][0].value);
    if (uploadType === "image") {
      setUploadBucket("public");
    } else if (uploadType === "audio") {
      setUploadBucket("private");
    } else if (uploadType === "video") {
      setUploadBucket("public");
    }
  }, [uploadType]);

  async function loadItems() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (bucketFilter !== "all") params.append("bucket", bucketFilter);
      if (mediaFilter !== "all") params.append("mediaType", mediaFilter);
      if (prefixFilter.trim()) params.append("prefix", prefixFilter.trim());

      const res = await fetch(`/api/storage/objects?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nepodařilo se načíst úložiště.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se načíst úložiště.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [bucketFilter, mediaFilter, prefixFilter, limit]);

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} zkopírován.`);
    } catch {
      setNotice("Kopírování selhalo. Zkuste to znovu.");
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError("Vyberte soubor.");
      safeOpenFileDialog(fileRef.current, {
        component: "StoragePage",
        source: "upload-submit-empty",
        label: "Nahrát soubor",
      });
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadResult("");
    setNotice("");
    logUploadDiagnostic("upload_started", {
      component: "StoragePage",
      source: "upload-submit",
      name: file.name,
      type: file.type,
      size: file.size,
      uploadType,
    });

    try {
      const key = createObjectKey(uploadPrefix, file.name);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", key);

      let res: Response;
      if (uploadType === "image") {
        res = await fetch("/api/upload/image", { method: "POST", body: formData });
      } else {
        formData.append("isPrivate", String(uploadBucket === "private"));
        res = await fetch("/api/upload/media", { method: "POST", body: formData });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload selhal.");

      const storedUrl = typeof data.storedUrl === "string"
        ? data.storedUrl
        : typeof data.mediaUrl === "string"
          ? data.mediaUrl
          : null;

      if (!storedUrl) throw new Error("Upload nevrátil storedUrl.");

      setUploadResult(storedUrl);
      logUploadDiagnostic("upload_done", {
        component: "StoragePage",
        source: "upload-submit",
        storedUrl,
      });
      if (fileRef.current) fileRef.current.value = "";
      await loadItems();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload selhal.");
      logUploadDiagnostic("upload_failed", {
        component: "StoragePage",
        source: "upload-submit",
        error: err instanceof Error ? err.message : "Upload selhal.",
      });
    } finally {
      setUploading(false);
    }
  }

  const visibleItems = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.key.toLowerCase().includes(q) ||
      item.storedUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Uložiště</h1>
        <p className="text-sm text-sub mt-1">
          Přímý upload do storage + centrální výpis souborů s filtrováním.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Nahrát soubor</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="text-sub">Typ</span>
            <select
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value as MediaType)}
              className="w-full rounded-md border border-white/10 bg-s2 px-3 py-2 text-white focus:border-lime focus:outline-none"
            >
              <option value="image">Obrázek</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-sub">Bucket</span>
            <select
              value={uploadType === "image" ? "public" : uploadBucket}
              onChange={(event) => setUploadBucket(event.target.value as Bucket)}
              disabled={uploadType === "image"}
              className="w-full rounded-md border border-white/10 bg-s2 px-3 py-2 text-white focus:border-lime focus:outline-none disabled:opacity-60"
            >
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="text-sub">Prefix / složka</span>
            <select
              value={uploadPrefix}
              onChange={(event) => setUploadPrefix(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-s2 px-3 py-2 text-white focus:border-lime focus:outline-none"
            >
              {PREFIX_OPTIONS[uploadType].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            className="max-w-full text-sm text-sub file:mr-3 file:rounded file:border-0 file:bg-s2 file:px-3 file:py-2 file:text-white"
            onClick={() =>
              logUploadDiagnostic("picker_attempt", {
                component: "StoragePage",
                source: "native-file-input",
              })
            }
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              logUploadDiagnostic("file_selected", {
                component: "StoragePage",
                source: "native-file-input",
                name: file.name,
                type: file.type,
                size: file.size,
              });
            }}
          />
          <Button onClick={handleUpload} loading={uploading} disabled={uploading}>
            <Upload size={16} />
            Nahrát do úložiště
          </Button>
        </div>

        {uploadError ? <p className="text-sm text-red-400">{uploadError}</p> : null}
        {uploadResult ? (
          <p className="text-sm text-lime break-all inline-flex items-center gap-2">
            <CheckCircle2 size={15} />
            Upload OK: {uploadResult}
          </p>
        ) : null}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm">
            <span className="text-sub">Bucket</span>
            <select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value as "all" | Bucket)} className="rounded-md border border-white/10 bg-s2 px-3 py-2 text-white focus:border-lime focus:outline-none">
              <option value="all">Vše</option>
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-sub">Médium</span>
            <select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as "all" | MediaType)} className="rounded-md border border-white/10 bg-s2 px-3 py-2 text-white focus:border-lime focus:outline-none">
              <option value="all">Vše</option>
              <option value="image">Obrázky</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm min-w-52">
            <span className="text-sub">Prefix</span>
            <input value={prefixFilter} onChange={(event) => setPrefixFilter(event.target.value)} className="w-full rounded-md border border-white/10 bg-s2 px-3 py-2 text-white placeholder:text-sub focus:border-lime focus:outline-none" placeholder="např. homepage/hero/" />
          </label>

          <label className="space-y-1.5 text-sm min-w-52">
            <span className="text-sub">Hledat key</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-white/10 bg-s2 px-3 py-2 text-white placeholder:text-sub focus:border-lime focus:outline-none" placeholder="část object key..." />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-sub">Limit</span>
            <select value={String(limit)} onChange={(event) => setLimit(Number(event.target.value))} className="rounded-md border border-white/10 bg-s2 px-3 py-2 text-white focus:border-lime focus:outline-none">
              <option value="100">100</option>
              <option value="240">240</option>
              <option value="400">400</option>
            </select>
          </label>

          <Button variant="secondary" onClick={() => void loadItems()} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Obnovit
          </Button>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {notice ? <p className="text-sm text-lime">{notice}</p> : null}

        {loading ? (
          <div className="text-sub inline-flex items-center gap-2 py-10">
            <Loader2 size={15} className="animate-spin" />
            Načítám soubory...
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="text-sub py-8">Žádné soubory neodpovídají filtru.</p>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <div key={`${item.bucket}:${item.key}`} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] gap-3 rounded-lg border border-border bg-s2 p-3">
                <div className="h-20 overflow-hidden rounded-md bg-black/40 flex items-center justify-center">
                  {item.mediaType === "image" && item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.key} className="h-full w-full object-cover" />
                  ) : item.mediaType === "video" && item.previewUrl ? (
                    <video src={item.previewUrl} muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs uppercase tracking-[0.12em] text-sub">{item.mediaType}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-white">{item.key}</p>
                  <p className="truncate text-xs text-sub">{item.storedUrl}</p>
                  <div className="mt-1 text-[11px] text-sub flex flex-wrap gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 uppercase", item.bucket === "private" ? "bg-amber-500/20 text-amber-200" : "bg-lime/20 text-lime")}>{item.bucket}</span>
                    <span>{formatBytes(item.size)}</span>
                    <span>{formatDate(item.lastModified)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(item.key, "Object key")}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white hover:border-lime/50 hover:text-lime"
                  >
                    <Copy size={12} />
                    Key
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(item.storedUrl, "storedUrl")}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white hover:border-lime/50 hover:text-lime"
                  >
                    <Copy size={12} />
                    URL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
