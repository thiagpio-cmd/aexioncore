"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Source {
  title: string;
  url: string;
  snippet: string;
}

interface SnapshotSection {
  topic: string;
  summary: string;
  sources: Source[];
}

interface MarketSnapshot {
  date: string;
  sections: SnapshotSection[];
  generatedAt: string;
  searchCount: number;
}

// ─── Section Icons ──────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Market Trends & Cap Rates": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  "Investment Sales & Deal Volume": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "Financing & Interest Rates": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  "Sun Belt Markets": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  "Distressed Assets & Opportunities": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

function getSectionIcon(topic: string): React.ReactNode {
  return (
    SECTION_ICONS[topic] || (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    )
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4"
          style={{ borderColor: "color-mix(in srgb, var(--border-subtle) 60%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[var(--border-subtle)]" />
            <div className="h-5 w-48 rounded bg-[var(--border-subtle)]" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-[var(--border-subtle)]" />
            <div className="h-3 w-5/6 rounded bg-[var(--border-subtle)]" />
            <div className="h-3 w-4/6 rounded bg-[var(--border-subtle)]" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-3 w-64 rounded bg-[var(--border-subtle)]" />
            <div className="h-3 w-56 rounded bg-[var(--border-subtle)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────────────────────

function SectionCard({ section }: { section: SnapshotSection }) {
  const [expanded, setExpanded] = useState(false);
  const visibleSources = expanded ? section.sources : section.sources.slice(0, 3);

  return (
    <div
      className="rounded-xl border bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--border-hover)]"
      style={{ borderColor: "color-mix(in srgb, var(--border-subtle) 60%, transparent)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-muted, color-mix(in srgb, var(--accent) 15%, transparent))", color: "var(--accent)" }}
        >
          {getSectionIcon(section.topic)}
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {section.topic}
        </h3>
      </div>

      {/* AI Summary */}
      {section.summary ? (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-4">
          {section.summary}
        </p>
      ) : (
        <p className="text-sm italic text-[var(--text-muted)] mb-4">
          No AI summary available for this topic.
        </p>
      )}

      {/* Sources */}
      {section.sources.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Sources
          </p>
          {visibleSources.map((src, i) => (
            <div key={i} className="group">
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--accent)] hover:underline"
              >
                {src.title}
                <span className="ml-1 inline-block opacity-0 transition-opacity group-hover:opacity-100">
                  &#8599;
                </span>
              </a>
              {src.snippet && (
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)] line-clamp-2">
                  {src.snippet}
                </p>
              )}
            </div>
          ))}
          {section.sources.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {expanded ? "Show less" : `+${section.sources.length - 3} more sources`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function MarketIntelligencePage() {
  const { data: session } = useSession();
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = (session?.user as any)?.role as string | undefined;
  const canRefresh = userRole === "ADMIN" || userRole === "MANAGER";

  // ── Fetch today's snapshot ──────────────────────────────────────────────

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market-intelligence");
      const json = await res.json();
      if (json.success) {
        setSnapshot(json.data.snapshot);
      } else {
        setError(json.error?.message || "Failed to load market data");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // ── Generate fresh snapshot ─────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/market-intelligence", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Failed to generate report");
      } else {
        // Refetch to show the new data
        await fetchSnapshot();
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Format timestamp ────────────────────────────────────────────────────

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Market Intelligence
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Daily CRE market snapshot powered by AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          {snapshot && (
            <span className="text-xs text-[var(--text-muted)]">
              Updated {formatTimestamp(snapshot.generatedAt)}
            </span>
          )}
          {canRefresh && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--color-danger-border, #ef4444)",
            background: "var(--color-danger-muted, color-mix(in srgb, #ef4444 10%, transparent))",
            color: "var(--color-danger, #ef4444)",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && <SkeletonCards />}

      {/* Empty state */}
      {!loading && !snapshot && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-20"
          style={{
            borderColor: "color-mix(in srgb, var(--border-subtle) 60%, transparent)",
            background: "var(--bg-card)",
          }}
        >
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "var(--accent-muted, color-mix(in srgb, var(--accent) 12%, transparent))", color: "var(--accent)" }}
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            No market data for today
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm text-center">
            Generate a fresh daily report to see the latest CRE market trends, cap rates, and opportunities.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Spinner className="h-4 w-4" />
                Generating report...
              </>
            ) : (
              "Generate Daily Report"
            )}
          </button>
        </div>
      )}

      {/* Snapshot content */}
      {!loading && snapshot && (
        <>
          {/* Summary bar */}
          <div
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-[var(--text-secondary)]"
            style={{
              borderColor: "color-mix(in srgb, var(--border-subtle) 60%, transparent)",
              background: "var(--bg-card)",
            }}
          >
            <svg className="h-4 w-4 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <span>
              {snapshot.searchCount} intelligence sources analyzed across{" "}
              {snapshot.sections.length} market sectors for{" "}
              <strong>{snapshot.date}</strong>
            </span>
          </div>

          {/* Section cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {snapshot.sections.map((section, i) => (
              <SectionCard key={i} section={section} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
