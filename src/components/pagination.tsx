"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // Build visible page numbers (max 7 slots)
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
    height: 32,
    padding: "0 8px",
    borderRadius: "var(--radius-sm)",
    border: "0.5px solid var(--border-subtle)",
    background: "var(--bg-card)",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition-default)",
    fontVariantNumeric: "tabular-nums",
  };

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: "var(--accent-muted)",
    borderColor: "var(--accent-border)",
    color: "var(--accent-text)",
    fontWeight: 600,
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    opacity: 0.4,
    cursor: "not-allowed",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-md) 0",
        gap: "var(--space-md)",
      }}
    >
      <span style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
        Showing {start}–{end} of {total}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {/* Previous */}
        <button
          onClick={() => page > 1 && onPageChange(page - 1)}
          style={page <= 1 ? btnDisabled : btnBase}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} style={{ ...btnBase, border: "none", background: "transparent", cursor: "default" }}>
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={p === page ? btnActive : btnBase}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => page < totalPages && onPageChange(page + 1)}
          style={page >= totalPages ? btnDisabled : btnBase}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
