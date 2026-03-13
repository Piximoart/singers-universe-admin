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
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logUploadDiagnostic } from "@/lib/uploadDiagnostics";
import { safeOpenFileDialog } from "@/lib/safeOpenFileDialog";

type FileStatus = "pending" | "uploading" | "done" | "error" | "skipped";
type MediaType = "audio" | "video";

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

interface AlbumOption {
  value: string;
  label: string;
  singerId: string;
}

function autoSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fileTitle(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function detectMediaType(file: File): MediaType {
  const t = file.type;
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "flac", "ogg", "aac", "m4a", "aiff", "opus"].includes(ext)) return "audio";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  throw new Error("Nepodporovaný typ souboru");
}

function fileId() {
  return Math.random().toString(36).slice(2);
}

const MEDIA_ICONS: Record<MediaType, typeof Music> = {
  audio: Music,
  video: Film,
};

const ACCEPT = [
  "audio/mpeg", "audio/wav", "audio/flac", "audio/ogg",
  "audio/aac", "audio/x-m4a", "audio/mp4", "audio/aiff",
  "audio/x-aiff", "audio/opus",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/*", "video/*",
].join(",");

async function uploadFile(
  bf: BulkFile,
  singerId: string,
  onProgress: (id: string, pct: number) => void,
): Promise<{ mediaUrl: string }> {
  const fallbackExt = bf.mediaType === "video" ? "mp4" : "mp3";
  const ext = bf.file.name.split(".").pop() ?? fallbackExt;
  const key = `${bf.mediaType}/${singerId}/${bf.slug}.${ext}`;

  let uploadedMediaUrl: string | null = null;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", bf.file);
    body.append("key", key);
    body.append("isPrivate", "true");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(bf.id, Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        try {
          const payload = JSON.parse(xhr.responseText) as {
            mediaUrl?: string;
            storedUrl?: string;
          };
          uploadedMediaUrl = payload.mediaUrl || payload.storedUrl || null;
          if (!uploadedMediaUrl) {
            reject(new Error("Upload nevrátil media URL"));
            return;
          }
          resolve();
        } catch {
          reject(new Error("Neplatná odpověď upload API"));
        }
        return;
      }

      reject(new Error(`Upload selhal: ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Síťová chyba")));
    xhr.open("POST", "/api/upload/media");
    xhr.send(body);
  });

  return { mediaUrl: uploadedMediaUrl ?? "" };
}

export default function BulkUploadPage() {
  const router = useRouter();
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [allAlbums, setAllAlbums] = useState<AlbumOption[]>([]);
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [singerId, setSingerId] = useState("");
  const [albumId, setAlbumId] = useState("");

  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  const [files, setFiles] = useState<BulkFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [dragging, setDragging] = useState(false);

  const canUploadSelection = !!singerId && !!albumId;
  const uploadLockReason = !singerId
    ? "Nejdřív vyberte zpěváka / influencera."
    : !albumId
      ? "Nejdřív vyberte album."
      : "";

  function openBulkPicker(source: string) {
    if (!canUploadSelection) {
      const reason = uploadLockReason || "Nejdřív vyberte zpěváka / influencera a album.";
      setGlobalError(reason);
      logUploadDiagnostic("picker_blocked", {
        component: "BulkUpload",
        source,
        reason,
      });
      return;
    }

    setGlobalError("");
    const opened = safeOpenFileDialog(inputRef.current, {
      component: "BulkUpload",
      source,
      label: "Bulk upload",
    });
    if (!opened) {
      setGlobalError("Nepodařilo se otevřít výběr souborů.");
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/singers").then((r) => r.json()),
      fetch("/api/albums").then((r) => r.json()),
    ]).then(([s, a]) => {
      setSingers(
        (s.items || []).map((x: { id: string; stage_name: string }) => ({
          value: x.id,
          label: x.stage_name,
        })),
      );

      const loadedAlbums: AlbumOption[] = (a.items || []).map(
        (x: { id: string; title: string; singer_id: string; singers?: { stage_name?: string } }) => ({
          value: x.id,
          singerId: x.singer_id,
          label: `${x.title} (${x.singers?.stage_name ?? "?"})`,
        }),
      );

      setAllAlbums(loadedAlbums);
      setAlbums([]);
    }).catch(() => {
      setGlobalError("Nepodařilo se načíst zpěváky/alba.");
    });
  }, []);

  useEffect(() => {
    if (!singerId) {
      setAlbums([]);
      setAlbumId("");
      return;
    }

    setAlbums(allAlbums.filter((a) => a.singerId === singerId));
  }, [allAlbums, singerId]);

  function addFiles(newFiles: FileList | File[]) {
    if (!canUploadSelection) {
      const reason = uploadLockReason || "Nejdřív vyberte zpěváka / influencera a album.";
      setGlobalError(reason);
      logUploadDiagnostic("picker_blocked", {
        component: "BulkUpload",
        source: "add-files",
        reason,
      });
      return;
    }

    const arr = Array.from(newFiles).slice(0, 50 - files.length);
    const rejected: string[] = [];
    const mapped: BulkFile[] = [];

    for (const f of arr) {
      try {
        mapped.push({
          id: fileId(),
          file: f,
          title: fileTitle(f.name),
          slug: autoSlug(f.name),
          mediaType: detectMediaType(f),
          status: "pending",
          progress: 0,
          mediaUrl: null,
          error: null,
        });
      } catch {
        rejected.push(f.name);
      }
    }

    if (rejected.length > 0) {
      setGlobalError(
        `Nepodporovaný typ souboru: ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}`,
      );
    } else {
      setGlobalError("");
    }

    if (mapped.length === 0) return;

    logUploadDiagnostic("file_selected", {
      component: "BulkUpload",
      source: "add-files",
      count: mapped.length,
      names: mapped.map((item) => item.file.name).slice(0, 10),
    });
    setFiles((prev) => [...prev, ...mapped]);
  }

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
    if (!canUploadSelection) {
      const reason = uploadLockReason || "Nejdřív vyberte zpěváka / influencera a album.";
      setGlobalError(reason);
      logUploadDiagnostic("picker_blocked", {
        component: "BulkUpload",
        source: "drop",
        reason,
      });
      return;
    }
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(id: string) {
    logUploadDiagnostic("upload_removed", { component: "BulkUpload", fileId: id });
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFile(id: string, patch: Partial<BulkFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function handleUpload() {
    if (!canUploadSelection) {
      const reason = uploadLockReason || "Vyberte zpěváka / influencera i album.";
      setGlobalError(reason);
      return;
    }

    setGlobalError("");
    setUploading(true);

    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    const CONCURRENCY = 3;
    let idx = 0;

    async function worker() {
      while (idx < pending.length) {
        const bf = pending[idx++];
        updateFile(bf.id, { status: "uploading", progress: 0, error: null });
        logUploadDiagnostic("upload_started", {
          component: "BulkUpload",
          source: "worker",
          fileId: bf.id,
          name: bf.file.name,
          mediaType: bf.mediaType,
        });
        try {
          const { mediaUrl } = await uploadFile(bf, singerId, (id, pct) =>
            updateFile(id, { progress: pct }),
          );
          updateFile(bf.id, { status: "done", progress: 100, mediaUrl, error: null });
          logUploadDiagnostic("upload_done", {
            component: "BulkUpload",
            source: "worker",
            fileId: bf.id,
            mediaUrl,
          });
        } catch (err) {
          updateFile(bf.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload selhal",
          });
          logUploadDiagnostic("upload_failed", {
            component: "BulkUpload",
            source: "worker",
            fileId: bf.id,
            error: err instanceof Error ? err.message : "Upload selhal",
          });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
    setUploading(false);
  }

  async function handleSave() {
    const done = files.filter((f) => f.status === "done" && f.mediaUrl);
    if (!done.length) return;
    if (!canUploadSelection) {
      const reason = uploadLockReason || "Vyberte zpěváka / influencera i album.";
      setGlobalError(reason);
      return;
    }

    setSaving(true);
    setGlobalError("");

    try {
      const tracks = done.map((f) => ({
        client_id: f.id,
        singer_id: singerId,
        album_id: albumId,
        title: f.title,
        slug: f.slug,
        media_type: f.mediaType,
        media_url: f.mediaUrl,
        cover_url: null,
        track_number: null,
        duration_seconds: 0,
        has_lyrics: false,
        lyrics_text: "",
        is_instrumental: false,
        is_premium_backstage: false,
        is_premium_headliner: false,
      }));

      const res = await fetch("/api/tracks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uložení selhalo");

      const failedByClient = new Map<string, string>();
      const skippedByClient = new Map<string, string>();

      for (const item of data.failed ?? []) {
        if (item.client_id) failedByClient.set(String(item.client_id), String(item.reason ?? "DB chyba"));
      }
      for (const item of data.skipped ?? []) {
        if (item.client_id) skippedByClient.set(String(item.client_id), String(item.reason ?? "Přeskočeno"));
      }

      setFiles((prev) =>
        prev.map((f) => {
          const failedReason = failedByClient.get(f.id);
          if (failedReason) {
            return { ...f, status: "error", error: failedReason };
          }
          const skippedReason = skippedByClient.get(f.id);
          if (skippedReason) {
            return { ...f, status: "skipped", error: skippedReason };
          }
          if (f.status === "done") {
            return { ...f, error: null };
          }
          return f;
        }),
      );

      const createdCount = Number(data.createdCount ?? 0);
      setSavedCount(createdCount);
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

  async function handleCreateAlbum() {
    if (!singerId) {
      setGlobalError("Nejdřív vyberte zpěváka / influencera.");
      return;
    }
    const title = newAlbumTitle.trim();
    if (!title) {
      setGlobalError("Zadejte název alba.");
      return;
    }

    setCreatingAlbum(true);
    setGlobalError("");

    try {
      const slug = autoSlug(title);
      const payload = {
        singer_id: singerId,
        title,
        slug,
        short_description: "",
        long_description: "",
        release_date: null,
        cover_url: "",
        is_premium_backstage: false,
        is_premium_headliner: false,
      };

      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Vytvoření alba selhalo");
      }

      const created = data.album as { id: string; title: string; singer_id: string };
      const option: AlbumOption = {
        value: created.id,
        singerId: created.singer_id,
        label: created.title,
      };

      setAllAlbums((prev) => [option, ...prev]);
      setAlbumId(created.id);
      setNewAlbumTitle("");
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Vytvoření alba selhalo");
    } finally {
      setCreatingAlbum(false);
    }
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const skippedCount = files.filter((f) => f.status === "skipped").length;

  const selectClass =
    "bg-s2 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors";

  return (
    <div>
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

      <div className="grid grid-cols-2 gap-4 mb-4 max-w-2xl">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            Zpěvák / influencer <span className="text-red-400">*</span>
          </label>
          <select
            value={singerId}
            onChange={(e) => {
              const nextSinger = e.target.value;
              setSingerId(nextSinger);
              setAlbumId("");
              setFiles([]);
              setGlobalError("");
            }}
            className={selectClass}
          >
            <option value="">Vyberte zpěváka / influencera...</option>
            {singers.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            Album <span className="text-red-400">*</span>
          </label>
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className={selectClass}
            disabled={!singerId}
          >
            <option value="">Vyberte album...</option>
            {albums.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-2xl mb-6">
        <label className="block text-xs text-sub mb-1">Quick create album</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newAlbumTitle}
            onChange={(e) => setNewAlbumTitle(e.target.value)}
            className="bg-s2 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white flex-1 focus:outline-none focus:border-lime transition-colors"
            placeholder="Např. Marlow Test Album"
            disabled={!singerId || creatingAlbum}
          />
          <button
            onClick={handleCreateAlbum}
            disabled={!singerId || creatingAlbum || !newAlbumTitle.trim()}
            className="bg-s2 border border-white/10 text-white text-sm font-semibold px-4 py-2.5 rounded-md hover:border-lime/50 hover:text-lime transition-colors disabled:opacity-50"
          >
            {creatingAlbum ? "Vytvářím..." : "Vytvořit"}
          </button>
        </div>
      </div>

      {files.length < 50 && (
        <div
          ref={dropRef}
          onClick={() => openBulkPicker("dropzone")}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6",
            dragging
              ? "border-lime bg-lime/5 text-lime"
              : "border-white/10 hover:border-white/30 text-sub",
            !canUploadSelection && "opacity-60 cursor-not-allowed",
          )}
        >
          <Upload size={32} className="mx-auto mb-3 opacity-60" />
          <p className="text-sm font-medium">
            {canUploadSelection
              ? "Přetáhněte soubory sem nebo klikněte pro výběr"
              : "Nejdřív vyberte zpěváka / influencera i album"}
          </p>
          <p className="text-xs mt-1 opacity-70">
            MP3, WAV, FLAC, OGG, AAC, M4A, AIFF · MP4, MOV, WebM
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
        className="h-0 w-0 opacity-0 absolute pointer-events-none"
        onChange={(e) => {
          if (e.target.files?.length) {
            addFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="space-y-2 mb-6">
          {files.map((bf) => {
            const Icon = MEDIA_ICONS[bf.mediaType];
            return (
              <div
                key={bf.id}
                className="bg-s1 rounded-lg px-4 py-3 flex items-center gap-3"
              >
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
                  {bf.status === "skipped" && (
                    <AlertTriangle size={18} className="text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={bf.title}
                    disabled={bf.status === "uploading"}
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
                    disabled={bf.status === "uploading"}
                    onChange={(e) =>
                      updateFile(bf.id, { slug: autoSlug(e.target.value) })
                    }
                    className="bg-s2 rounded px-2 py-1 text-sm text-sub outline-none focus:ring-1 focus:ring-lime/40 disabled:opacity-50 truncate font-mono text-xs"
                    placeholder="slug"
                  />
                </div>

                <div className="shrink-0 text-right hidden sm:block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sub">
                    {bf.mediaType}
                  </span>
                  <p className="text-[10px] text-sub/60">
                    {(bf.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>

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

                {(bf.status === "error" || bf.status === "skipped") && (
                  <p
                    className={cn(
                      "shrink-0 text-xs max-w-[180px] truncate",
                      bf.status === "error" ? "text-red-400" : "text-amber-400",
                    )}
                    title={bf.error ?? ""}
                  >
                    {bf.error}
                  </p>
                )}

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

      {globalError && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-4">
          {globalError}
        </p>
      )}

      {savedCount !== null && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mb-4">
          ✓ Uloženo {savedCount} tracků do databáze
        </p>
      )}

      {files.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {pendingCount > 0 && (
            <button
              onClick={handleUpload}
              disabled={uploading || !canUploadSelection}
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
              disabled={saving || !canUploadSelection}
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
                    f.status === "error" ? { ...f, status: "pending", error: null } : f,
                  ),
                )
              }
              className="text-sm text-red-400 hover:text-white transition-colors"
            >
              Zkusit znovu ({errorCount})
            </button>
          )}

          {skippedCount > 0 && (
            <span className="text-xs text-amber-400">Přeskočeno: {skippedCount}</span>
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
