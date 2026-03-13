"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

type PickerMediaType = "image" | "audio" | "video";
type PickerBucket = "public" | "private";

export type StoragePickerItem = {
  key: string;
  bucket: PickerBucket;
  mediaType: PickerMediaType | "unknown";
  size: number;
  lastModified: string | null;
  storedUrl: string;
  previewUrl: string | null;
};

interface StorageObjectPickerProps {
  open: boolean;
  title: string;
  mediaTypes: PickerMediaType[];
  buckets: PickerBucket[];
  prefixes?: string[];
  onClose: () => void;
  onSelect: (item: StoragePickerItem) => void;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string | null) {
  if (!value) return "Neznámé datum";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Neznámé datum";
  return date.toLocaleString("cs-CZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StorageObjectPicker({
  open,
  title,
  mediaTypes,
  buckets,
  prefixes,
  onClose,
  onSelect,
}: StorageObjectPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StoragePickerItem[]>([]);

  async function loadItems() {
    if (!open) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "240");
      mediaTypes.forEach((mediaType) => params.append("mediaType", mediaType));
      buckets.forEach((bucket) => params.append("bucket", bucket));
      prefixes?.forEach((prefix) => {
        if (prefix.trim()) params.append("prefix", prefix.trim());
      });

      const res = await fetch(`/api/storage/objects?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Načtení souborů selhalo");

      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Načtení souborů selhalo");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      return (
        item.key.toLowerCase().includes(normalized) ||
        item.storedUrl.toLowerCase().includes(normalized)
      );
    });
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-5xl rounded-xl border border-border bg-s1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-xs text-sub">
              Vyberte existující soubor ze storage podle object key.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-sub transition-colors hover:bg-s2 hover:text-white"
            aria-label="Zavřít výběr souboru"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrovat podle object key..."
              className="w-full rounded-md border border-white/10 bg-s2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-sub focus:border-lime focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-s2 px-3 py-2 text-sm text-white transition-colors hover:border-lime/50 hover:text-lime disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Obnovit
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sub">
              <Loader2 size={16} className="animate-spin" />
              Načítám soubory ze storage…
            </div>
          ) : error ? (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="rounded-md border border-border bg-s2 px-3 py-6 text-center text-sm text-sub">
              Ve storage nebyl nalezen žádný odpovídající soubor.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={`${item.bucket}:${item.key}`}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)_9rem] gap-3 rounded-lg border border-border bg-s2 p-3"
                >
                  <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-black/40">
                    {item.mediaType === "image" && item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.key} className="h-full w-full object-cover" />
                    ) : item.mediaType === "video" && item.previewUrl ? (
                      <video src={item.previewUrl} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] uppercase tracking-[0.14em] text-sub">{item.mediaType}</span>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-mono text-xs text-white">{item.key}</p>
                    <p className="truncate text-xs text-sub">{item.storedUrl}</p>
                    <div className="flex items-center gap-2 text-[11px] text-sub">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 uppercase tracking-[0.08em]",
                          item.bucket === "private"
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-lime/20 text-lime",
                        )}
                      >
                        {item.bucket}
                      </span>
                      <span>{formatBytes(item.size)}</span>
                      <span>{formatDate(item.lastModified)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="rounded-md bg-lime px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-white"
                    >
                      Vybrat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
