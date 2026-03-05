"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Database } from "lucide-react";

type PreviewItem = {
  key: string;
  storedUrl: string;
  media_type: "audio" | "video";
  size: number;
  lastModified: string | null;
  suggested_title: string;
  suggested_slug: string;
  existsInDb: boolean;
  existingTrackId: string | null;
  selected: boolean;
  title: string;
  slug: string;
};

function autoSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function StorageImportPage() {
  const router = useRouter();
  const [singers, setSingers] = useState<{ value: string; label: string }[]>([]);
  const [albums, setAlbums] = useState<{ value: string; label: string }[]>([]);

  const [singerId, setSingerId] = useState("");
  const [albumId, setAlbumId] = useState("");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    createdCount: number;
    skipped: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/singers")
      .then((r) => r.json())
      .then((d) => {
        setSingers(
          (d.items || []).map((s: { id: string; stage_name: string }) => ({
            value: s.id,
            label: s.stage_name,
          })),
        );
      })
      .catch(() => setError("Nepodařilo se načíst zpěváky / influencery."));
  }, []);

  useEffect(() => {
    if (!singerId) {
      setAlbums([]);
      setAlbumId("");
      return;
    }

    fetch(`/api/albums?singerId=${encodeURIComponent(singerId)}`)
      .then((r) => r.json())
      .then((d) => {
        setAlbums(
          (d.items || []).map(
            (a: { id: string; title: string; singers?: { stage_name?: string } }) => ({
              value: a.id,
              label: `${a.title} (${a.singers?.stage_name ?? "?"})`,
            }),
          ),
        );
      })
      .catch(() => setError("Nepodařilo se načíst alba."));
  }, [singerId]);

  const selectedCount = useMemo(
    () => items.filter((item) => item.selected && !item.existsInDb).length,
    [items],
  );

  async function handleLoadPreview() {
    if (!singerId) {
      setError("Vyberte zpěváka / influencera.");
      return;
    }
    setSummary(null);
    setError("");
    setLoadingPreview(true);

    try {
      const res = await fetch(
        `/api/tracks/storage-import?singerId=${encodeURIComponent(singerId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Načtení preview selhalo");

      const loaded: PreviewItem[] = (data.items || []).map(
        (item: Omit<PreviewItem, "selected" | "title" | "slug">) => ({
          ...item,
          selected: !item.existsInDb,
          title: item.suggested_title,
          slug: item.suggested_slug,
        }),
      );
      setItems(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Načtení preview selhalo");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleImport() {
    if (!singerId || !albumId) {
      setError("Vyberte zpěváka / influencera i album.");
      return;
    }

    const selected = items.filter((item) => item.selected && !item.existsInDb);
    if (!selected.length) {
      setError("Není vybrána žádná položka pro import.");
      return;
    }

    setImporting(true);
    setError("");
    setSummary(null);

    try {
      const res = await fetch("/api/tracks/storage-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          singerId,
          albumId,
          items: selected.map((item) => ({
            key: item.key,
            title: item.title.trim(),
            slug: autoSlug(item.slug),
            media_type: item.media_type,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import selhal");

      setSummary({
        createdCount: Number(data.createdCount ?? 0),
        skipped: Array.isArray(data.skipped) ? data.skipped.length : 0,
        failed: Array.isArray(data.failed) ? data.failed.length : 0,
      });

      await handleLoadPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import selhal");
    } finally {
      setImporting(false);
    }
  }

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
          <h1 className="text-2xl font-bold text-white">Storage import</h1>
          <p className="text-sub text-sm">Ruční backfill tracků ze storage do DB</p>
        </div>
      </div>

      <div className="bg-s1 border border-border rounded-lg p-5 mb-5">
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white">
              Zpěvák / influencer <span className="text-red-400">*</span>
            </label>
            <select
              value={singerId}
              onChange={(e) => {
                setSingerId(e.target.value);
                setAlbumId("");
                setItems([]);
                setSummary(null);
                setError("");
              }}
              className="bg-s2 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors"
            >
              <option value="">Vyberte...</option>
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
              disabled={!singerId}
              className="bg-s2 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors disabled:opacity-60"
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

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleLoadPreview}
            disabled={!singerId || loadingPreview}
            className="flex items-center gap-2 bg-s2 border border-white/10 text-white text-sm font-semibold px-4 py-2.5 rounded-md hover:border-lime/50 hover:text-lime transition-colors disabled:opacity-50"
          >
            {loadingPreview ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Načíst preview
          </button>

          <button
            onClick={handleImport}
            disabled={!singerId || !albumId || importing || selectedCount === 0}
            className="flex items-center gap-2 bg-lime text-bg text-sm font-semibold px-4 py-2.5 rounded-md hover:bg-white transition-colors disabled:opacity-50"
          >
            {importing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Database size={15} />
            )}
            Importovat vybrané ({selectedCount})
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {summary && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mb-4">
          ✓ Vytvořeno {summary.createdCount}, přeskočeno {summary.skipped}, chyb {summary.failed}
        </p>
      )}

      {items.length > 0 && (
        <div className="bg-s1 border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_1fr_100px_100px] gap-2 px-4 py-3 text-xs text-sub border-b border-border">
            <div />
            <div>Název</div>
            <div>Slug</div>
            <div>Typ</div>
            <div>Stav</div>
          </div>
          {items.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-[48px_1fr_1fr_100px_100px] gap-2 px-4 py-3 border-b border-border last:border-0 items-center"
            >
              <input
                type="checkbox"
                checked={item.selected}
                disabled={item.existsInDb}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row) =>
                      row.key === item.key ? { ...row, selected: e.target.checked } : row,
                    ),
                  )
                }
                className="h-4 w-4 accent-lime"
              />
              <input
                type="text"
                value={item.title}
                disabled={item.existsInDb}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row) =>
                      row.key === item.key ? { ...row, title: e.target.value } : row,
                    ),
                  )
                }
                className="bg-s2 rounded px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-lime/40 disabled:opacity-60"
              />
              <input
                type="text"
                value={item.slug}
                disabled={item.existsInDb}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row) =>
                      row.key === item.key ? { ...row, slug: autoSlug(e.target.value) } : row,
                    ),
                  )
                }
                className="bg-s2 rounded px-2 py-1 text-xs font-mono text-sub outline-none focus:ring-1 focus:ring-lime/40 disabled:opacity-60"
              />
              <div className="text-xs uppercase text-sub">{item.media_type}</div>
              <div
                className={
                  item.existsInDb ? "text-xs text-amber-400" : "text-xs text-green-400"
                }
              >
                {item.existsInDb ? "V DB" : "Nový"}
              </div>
              <div className="col-span-5 text-[11px] text-sub/70 truncate">{item.key}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
