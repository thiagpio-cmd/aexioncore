"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchKeys?: string[];
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data found",
  searchPlaceholder = "Search...",
  searchKeys = [],
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = data.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (searchKeys.length > 0) {
      return searchKeys.some((key) => {
        const val = item[key];
        return typeof val === "string" && val.toLowerCase().includes(q);
      });
    }
    return Object.values(item).some(
      (val) => typeof val === "string" && val.toLowerCase().includes(q)
    );
  });

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDir === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        return 0;
      })
    : filtered;

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
          <circle cx="9" cy="9" r="6" />
          <path d="m13.5 13.5 4 4" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
        />
        <span className="text-xs text-muted">{sorted.length} results</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted",
                    col.sortable && "cursor-pointer select-none hover:text-foreground"
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={sortDir === "desc" ? "rotate-180" : ""}>
                        <path d="M6 3l3 4H3l3-4z" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-background"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm">
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as React.ReactNode) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
