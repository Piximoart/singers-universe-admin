"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Music,
  Film,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Typy ────────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "uploading" | "done" | "error";
type MediaType = "audio" | "video" | "image";

interface BulkFile {
  id: string;
  file: File;
  title: string;
  slug: string;
  mediaType: MediaType;
  status: FileStatus;
  progress: number;
  mediaUrl: string | null;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function autoSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // odeber příponu
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
}

function fileTitle(name: string) {
  return name.replace(/\.[^.]+$/, ""); // bez přípony
}

function detectMediaType(file: File): MediaType {
  const t = file.type;
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  // fallback z přípony
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "flac", "ogg", "aac", "m4a", "aiff", "opus"].includes(ext)) return "audio";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  return "audio";
}

function fileId() {
  return Math.random().toString(36).slice(2);
}

const MEDIA_ICONS: Record<MediaType, typeof Music> = {
  audio: Music,
  video: Film,
  image: ImageIcon,
};

const ACCEPT = [
  "audio/mpeg", "audio/wav", "audio/flac", "audio/ogg",
  "audio/aac", "audio/x-m4a", "audio/mp4", "audio/aiff",
  "audio/x-aiff", "audio/opus",
  "video/mp4", "video/quicktime", "video/webm",
  "image/jpeg", "image/png", "image/webp",
  "audio/*", "video/*", "image/*",
].join(",");

// ─── Concurrent upload worker ─────────────────────────────────────────────────

async function uploadFile(
  bf: BulkFile,
  singerId: string,
  onProgress: (id: string, pct: number) => void,
): Promise<{ mediaUrl: string }> {
  const ext = bf.file.name.split(".").pop() ?? "mp3";
  const isPrivate = bf.mediaType !== "image";
  const key =
    bf.mediaType === "image"
      ? `covers/${bf.slug}.${ext}`
      : `${bf.mediaType}/${singerId}/${bf.slug}.${ext}`;

  // 1) Presign
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType: bf.file.type || "audio/mpeg", isPrivate }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || "Presign selhal");

  const { url: presignedUrl, publicUrl } = presignData;

  // 2) PUT na S3 s progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(bf.id, Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload selhal: ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Síťová chyba")));
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", bf.file.type || "audio/mpeg");
    xhr.send(bf.file);
  });

  return { mediaUrl: publicUrl };
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  const router = useRouter();
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [albums, setAlbums] = useState<{ value: string; label: string }[]>([]);
  const [singerId, setSingerId] = useState("");
  const [albumId, setAlbumId] = useState("");

  const [files, setFiles] = useState<BulkFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Načíst zpěváky + alba
  useEffect(() => {
    Promise.all([
      fetch("/api/singers").then((r) => r.json()),
      fetch("/api/albums").then((r) => r.json()),
    ]).then(([s, a]) => {
      setSingers(
        (s.items || []).map((x: { id: string; stage_name: string }) => ({
          value: x.id,
          label: x.stage_name,
        }))
      );
      setAlbums([
        { value: "", label: "Žádné (single)" },
        ...(a.items || []).map(
          (x: { id: string; title: string; singers: { stage_name: string } }) => ({
            value: x.id,
            label: `${x.title} (${x.singers?.stage_name ?? "?"})`,
          })
        ),
      ]);
    });
  }, []);

  // Přidat soubory ze seznamu
  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).slice(0, 50 - files.length);
    setFiles((prev) => [
      ...prev,
      ...arr.map((f) => ({
        id: fileId(),
        file: f,
        title: fileTitle(f.name),
        slug: autoSlug(f.name),
        mediaType: detectMediaType(f),
        status: "pending" as FileStatus,
        progress: 0,
        mediaUrl: null,
        error: null,
      })),
    ]);
  }

  // Drag & drop
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() {
    setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFile(id: string, patch: Partial<BulkFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  // ── Upload všech pending souborů (max 5 concurrent) ──────────────────────
  async function handleUpload() {
    if (!singerId) { setGlobalError("Vyberte zpěváka"); return; }
    setGlobalError("");
    setUploading(true);

    const pending = files.filter((f) => f.status === "pending");
    const CONCURRENCY = 5;
    let idx = 0;

    async function worker() {
      while (idx < pending.length) {
        const bf = pending[idx++];
        updateFile(bf.id, { status: "uploading", progress: 0, error: null });
        try {
          const { mediaUrl } = await uploadFile(bf, singerId, (id, pct) =>
            updateFile(id, { progress: pct })
          );
          updateFile(bf.id, { status: "done", progress: 100, mediaUrl });
        } catch (err) {
          updateFile(bf.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload selhal",
          });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
    setUploading(false);
  }

  // ── Uložit dokončené soubory do DB ────────────────────────────────────────
  async function handleSave() {
    const done = files.filter((f) => f.status === "done" && f.mediaUrl);
    if (!done.length) return;
    if (!singerId) { setGlobalError("Vyberte zpěváka"); return; }

    setSaving(true);
    setGlobalError("");
    try {
      const tracks = done.map((f) => ({
        singer_id: singerId,
        album_id: albumId || null,
        title: f.title,
        slug: f.slug,
        media_type: f.mediaType,
        media_url: f.mediaUrl,
        cover_url: null,
        track_number: null,
        duration_seconds: null,
        has_lyrics: false,
        lyrics_text: "",
        is_instrumental: false,
        is_premium_backstage: false,
        is_premium_headliner: false,
        released_at: null,
      }));

      const res = await fetch("/api/tracks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");

      setSavedCount(data.count);
      // Označit jako uložené — odeber ze seznamu po 2s
      setTimeout(() => {
        setFiles((prev) => prev.filter((f) => f.status !== "done"));
        setSavedCount(null);
      }, 2000);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  const selectClass =
    "bg-s2 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors";

  return (
    <div>
      {/* Hlavička */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-md text-sub hover:text-white hover:bg-s2 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Hromadný upload</h1>
          <p className="text-sub text-sm">Nahrajte až 50 souborů najednou</p>
        </div>
      </div>

      {/* Zpěvák + album */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-2xl">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            Zpěvák <span className="text-red-400">*</span>
          </label>
          <select
            value={singerId}
            onChange={(e) => setSingerId(e.target.value)}
            className={selectClass}
          >
            <option value="">Vyberte zpěváka...</option>
            {singers.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white">Album (volitelné)</label>
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className={selectClass}
          >
            {albums.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drop zona */}
      {files.length < 50 && (
        <div
          ref={dropRef}
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6",
            dragging
              ? "border-lime bg-lime/5 text-lime"
              : "border-white/10 hover:border-white/30 text-sub"
          )}
        >
          <Upload size={32} className="mx-auto mb-3 opacity-60" />
          <p className="text-sm font-medium">
            Přetáhněte soubory sem nebo klikněte pro výběr
          </p>
          <p className="text-xs mt-1 opacity-70">
            MP3, WAV, FLAC, OGG, AAC, M4A, AIFF · MP4, MOV, WebM · JPEG, PNG, WebP
          </p>
          <p className="text-xs mt-1 opacity-50">
            Max. 50 souborů · zbývá {50 - files.length} míst
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Seznam souborů */}
      {files.length > 0 && (
        <div className="space-y-2 mb-6">
          {files.map((bf) => {
            const Icon = MEDIA_ICONS[bf.mediaType];
            return (
              <div
                key={bf.id}
                className="bg-s1 rounded-lg px-4 py-3 flex items-center gap-3"
              >
                {/* Ikona stavu */}
                <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                  {bf.status === "pending" && (
                    <Icon size={18} className="text-sub" />
                  )}
                  {bf.status === "uploading" && (
                    <Loader2 size={18} className="text-lime animate-spin" />
                  )}
                  {bf.status === "done" && (
                    <CheckCircle size={18} className="text-green-400" />
                  )}
                  {bf.status === "error" && (
                    <AlertCircle size={18} className="text-red-400" />
                  )}
                </div>

                {/* Název + slug */}
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={bf.title}
                    disabled={bf.status === "uploading" || bf.status === "done"}
                    onChange={(e) => {
                      const title = e.target.value;
                      updateFile(bf.id, {
                        title,
                        slug: autoSlug(title),
                      });
                    }}
                    className="bg-s2 rounded px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-lime/40 disabled:opacity-50 truncate"
                    placeholder="Název tracku"
                  />
                  <input
                    type="text"
                    value={bf.slug}
                    disabled={bf.status === "uploading" || bf.status === "done"}
                    onChange={(e) =>
                      updateFile(bf.id, { slug: autoSlug(e.target.value) })
                    }
                    className="bg-s2 rounded px-2 py-1 text-sm text-sub outline-none focus:ring-1 focus:ring-lime/40 disabled:opacity-50 truncate font-mono text-xs"
                    placeholder="slug"
                  />
                </div>

                {/* Typ + velikost */}
                <div className="shrink-0 text-right hidden sm:block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sub">
                    {bf.mediaType}
                  </span>
                  <p className="text-[10px] text-sub/60">
                    {(bf.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>

                {/* Progress bar (uploading) */}
                {bf.status === "uploading" && (
                  <div className="shrink-0 w-20">
                    <div className="w-full bg-s4 rounded-full h-1.5">
                      <div
                        className="bg-lime h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${bf.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-sub text-right mt-0.5">{bf.progress}%</p>
                  </div>
                )}

                {/* Error text */}
                {bf.status === "error" && (
                  <p className="shrink-0 text-xs text-red-400 max-w-[120px] truncate" title={bf.error ?? ""}>
                    {bf.error}
                  </p>
                )}

                {/* Odstranit */}
                {bf.status !== "uploading" && (
                  <button
                    onClick={() => removeFile(bf.id)}
                    className="shrink-0 text-sub hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Globální chyba */}
      {globalError && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-4">
          {globalError}
        </p>
      )}

      {/* Úspěšné uložení */}
      {savedCount !== null && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mb-4">
          ✓ Uloženo {savedCount} tracků do databáze
        </p>
      )}

      {/* Akce */}
      {files.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {pendingCount > 0 && (
            <button
              onClick={handleUpload}
              disabled={uploading || !singerId}
              className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-white transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {uploading ? "Nahrávám..." : `Nahrát (${pendingCount})`}
            </button>
          )}

          {doneCount > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || !singerId}
              className="flex items-center gap-2 bg-s2 border border-white/10 text-white text-sm font-semibold px-5 py-2.5 rounded-md hover:border-lime/50 hover:text-lime transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? "Ukládám..." : `Uložit do DB (${doneCount})`}
            </button>
          )}

          {errorCount > 0 && (
            <button
              onClick={() =>
                setFiles((prev) =>
                  prev.map((f) =>
                    f.status === "error" ? { ...f, status: "pending", error: null } : f
                  )
                )
              }
              className="text-sm text-red-400 hover:text-white transition-colors"
            >
              Zkusit znovu ({errorCount})
            </button>
          )}

          <button
            onClick={() => setFiles([])}
            disabled={uploading}
            className="text-sm text-sub hover:text-white transition-colors ml-auto"
          >
            Vymazat vše
          </button>
        </div>
      )}
    </div>
  );
}
