"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/hooks/use-api";
import { NAV_ITEMS } from "@/lib/constants";
import { GlobalSearch } from "@/components/layout/global-search";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  const item = NAV_ITEMS.find((nav) => nav.href === pathname);
  if (item) return item.label;
  // Fallback: capitalize the first path segment
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : "Home";
}

export function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const title = getPageTitle(pathname);
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSearch]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/50 bg-surface/95 backdrop-blur-sm px-6">
        {/* Page title */}
        <h1 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h1>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Search trigger */}
          <button
            type="button"
            onClick={toggleSearch}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted transition-colors hover:border-muted/40 hover:text-foreground"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="m13.5 13.5 4 4" />
            </svg>
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline">
              Cmd+K
            </kbd>
          </button>

          {/* Notifications — linked to alerts */}
          <NotificationBell />

          {/* User avatar */}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary transition-opacity hover:opacity-80"
          >
            {initials}
          </button>
        </div>
      </header>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

// ─── NotificationBell with real alert data ───────────────────────────────────
function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useApi<{
    alerts: { id: string; type: string; severity: "critical" | "warning" | "info"; title: string; description?: string }[];
    summary: { critical: number; warning: number; info: number; total: number };
  }>("/api/alerts");

  const total = data?.summary?.total ?? 0;
  const alerts = data?.alerts ?? [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 0 0-5-5Z" />
          <path d="M8 15a2 2 0 1 0 4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {total > 0 && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">{total} active</span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">No notifications</div>
            ) : (
              alerts.slice(0, 8).map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => { setOpen(false); router.push("/"); }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-background"
                >
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    alert.severity === "critical" ? "bg-danger" : alert.severity === "warning" ? "bg-warning" : "bg-primary"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                    {alert.description && (
                      <p className="text-xs text-muted truncate mt-0.5">{alert.description}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          {alerts.length > 8 && (
            <div className="border-t border-border px-4 py-2">
              <button onClick={() => { setOpen(false); router.push("/"); }} className="text-xs text-primary hover:underline">
                View all {total} alerts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
