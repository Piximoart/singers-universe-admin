import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  editHref?: (row: T) => string;
  onDelete?: (id: string) => void;
  emptyMessage?: string;
}

export default function DataTable<T extends { id: string }>({
  columns,
  rows,
  editHref,
  onDelete,
  emptyMessage = "Žádné záznamy",
}: DataTableProps<T>) {
  return (
    <div className="bg-s1 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs text-sub uppercase tracking-wide font-medium"
              >
                {col.label}
              </th>
            ))}
            {(editHref || onDelete) && (
              <th className="px-4 py-3 text-right text-xs text-sub uppercase tracking-wide font-medium">
                Akce
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (editHref || onDelete ? 1 : 0)}
                className="px-4 py-8 text-center text-sub"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 last:border-0 hover:bg-s2 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-white">
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "—")}
                  </td>
                ))}
                {(editHref || onDelete) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {editHref && (
                        <Link
                          href={editHref(row)}
                          className="p-1.5 rounded text-sub hover:text-lime hover:bg-s3 transition-colors"
                          title="Upravit"
                        >
                          <Edit2 size={14} />
                        </Link>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row.id)}
                          className="p-1.5 rounded text-sub hover:text-red-400 hover:bg-s3 transition-colors"
                          title="Smazat"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
