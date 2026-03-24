"use client";

import { useState, useEffect, useRef, useMemo } from "react";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  label: string;
  category: string;
  href: string;
}

const MOCK_RESULTS: SearchResult[] = [
  { id: "l1", label: "Sarah Chen - VP Engineering", category: "Leads", href: "/leads/1" },
  { id: "l2", label: "Marcus Johnson - Head of Product", category: "Leads", href: "/leads/2" },
  { id: "l3", label: "Emily Rodriguez - CTO", category: "Leads", href: "/leads/3" },
  { id: "a1", label: "Acme Corporation", category: "Accounts", href: "/accounts/1" },
  { id: "a2", label: "TechStart Inc.", category: "Accounts", href: "/accounts/2" },
  { id: "a3", label: "Global Systems Ltd.", category: "Accounts", href: "/accounts/3" },
  { id: "o1", label: "Acme Corp - Enterprise License", category: "Opportunities", href: "/opportunities/1" },
  { id: "o2", label: "TechStart - Platform Migration", category: "Opportunities", href: "/opportunities/2" },
  { id: "c1", label: "John Smith - Acme Corp", category: "Contacts", href: "/accounts/1" },
  { id: "c2", label: "Lisa Wang - TechStart", category: "Contacts", href: "/accounts/2" },
  { id: "t1", label: "Follow up with Sarah Chen", category: "Tasks", href: "/tasks" },
  { id: "t2", label: "Prepare demo for Acme Corp", category: "Tasks", href: "/tasks" },
  { id: "t3", label: "Send proposal to TechStart", category: "Tasks", href: "/tasks" },
  { id: "i1", label: "Acme Corp engagement declining", category: "Insights", href: "/insights" },
  { id: "i2", label: "TechStart ready to close", category: "Insights", href: "/insights" },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Leads: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Accounts: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Opportunities: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  ),
  Contacts: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  Tasks: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Insights: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  ),
};

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredResults = useMemo(() => {
    if (!query.trim()) return MOCK_RESULTS;
    const lower = query.toLowerCase();
    return MOCK_RESULTS.filter(
      (r) =>
        r.label.toLowerCase().includes(lower) ||
        r.category.toLowerCase().includes(lower)
    );
  }, [query]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const result of filteredResults) {
      if (!groups[result.category]) {
        groups[result.category] = [];
      }
      groups[result.category].push(result);
    }
    return groups;
  }, [filteredResults]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredResults.length - 1
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filteredResults.length]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m13.5 13.5 4 4" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, accounts, opportunities..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted outline-none"
          />
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto px-2 py-2">
          {filteredResults.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(groupedResults).map(([category, results]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="mb-1 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  {CATEGORY_ICONS[category]}
                  {category}
                </div>
                {results.map((result) => {
                  const currentIndex = flatIndex++;
                  return (
                    <button
                      key={result.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        currentIndex === selectedIndex
                          ? "bg-primary/10 text-foreground"
                          : "text-muted hover:bg-background hover:text-foreground"
                      }`}
                      onClick={onClose}
                    >
                      <span className="truncate">{result.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium">
                &uarr;
              </kbd>
              <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium">
                &darr;
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium">
                &crarr;
              </kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium">
                ESC
              </kbd>
              Close
            </span>
          </div>
          <span className="text-[11px] text-muted">
            {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
