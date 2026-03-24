"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, cn } from "@/lib/utils";

interface SearchResults {
  leads: { id: string; name: string; email: string; status: string; temperature: string; owner?: { name: string } }[];
  opportunities: { id: string; title: string; value: number; stage: string; probability: number; owner?: { name: string } }[];
  contacts: { id: string; name: string; email?: string; phone?: string; title?: string }[];
  accounts: { id: string; name: string; status?: string; company?: { name: string; industry?: string; website?: string } }[];
  totalResults: number;
}

const CATEGORY_CONFIG = {
  leads: { label: "Leads", icon: "👤", href: (id: string) => `/leads/${id}` },
  opportunities: { label: "Deals", icon: "💼", href: (id: string) => `/opportunities/${id}` },
  contacts: { label: "Contacts", icon: "📇", href: (id: string) => `/accounts/${id}` },
  accounts: { label: "Accounts", icon: "🏢", href: (id: string) => `/accounts/${id}` },
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success) {
          setResults(json.data);
          setSelectedIndex(0);
        }
      } catch {}
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Build flat list of results for keyboard navigation
  const flatResults = results
    ? [
        ...results.leads.map((r) => ({ type: "leads" as const, id: r.id, name: r.name, sub: r.email, badge: r.status })),
        ...results.opportunities.map((r) => ({ type: "opportunities" as const, id: r.id, name: r.title, sub: formatCurrency(r.value, "USD"), badge: r.stage })),
        ...results.contacts.map((r) => ({ type: "contacts" as const, id: r.id, name: r.name, sub: r.email || r.phone || "", badge: r.title || "" })),
        ...results.accounts.map((r) => ({ type: "accounts" as const, id: r.id, name: r.name, sub: r.company?.website || "", badge: r.company?.industry || "" })),
      ]
    : [];

  const navigate = useCallback(
    (type: keyof typeof CATEGORY_CONFIG, id: string) => {
      router.push(CATEGORY_CONFIG[type].href(id));
      setOpen(false);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      const r = flatResults[selectedIndex];
      navigate(r.type, r.id);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-primary/30 transition-colors w-full"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <circle cx="9" cy="9" r="6" /><path d="m13.5 13.5 4 4" />
        </svg>
        <span className="flex-1 text-left text-xs">Search...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-surface px-1.5 text-[10px] font-medium text-muted">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[15%] z-50 mx-auto w-full max-w-lg" ref={containerRef}>
        <div className="rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <circle cx="9" cy="9" r="6" /><path d="m13.5 13.5 4 4" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search leads, deals, contacts, accounts..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {!results && !loading && query.length < 2 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted">Type at least 2 characters to search</p>
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted">
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                  <span>ESC Close</span>
                </div>
              </div>
            )}

            {results && flatResults.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted">No results for &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {results && flatResults.length > 0 && (
              <div className="py-2">
                {(["leads", "opportunities", "contacts", "accounts"] as const).map((category) => {
                  const items = flatResults.filter((r) => r.type === category);
                  if (items.length === 0) return null;
                  const config = CATEGORY_CONFIG[category];
                  return (
                    <div key={category}>
                      <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        {config.icon} {config.label}
                      </div>
                      {items.map((item) => {
                        const globalIdx = flatResults.indexOf(item);
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => navigate(item.type, item.id)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              globalIdx === selectedIndex
                                ? "bg-primary-light text-primary"
                                : "text-foreground hover:bg-background"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              {item.sub && (
                                <p className="text-xs text-muted truncate">{item.sub}</p>
                              )}
                            </div>
                            {item.badge && (
                              <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {results && flatResults.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-[11px] text-muted">
              {results.totalResults} result{results.totalResults !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      </div>
    </>
  );
}
