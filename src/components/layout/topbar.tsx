"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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

          {/* Notifications */}
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 0 0-5-5Z" />
              <path d="M8 15a2 2 0 1 0 4 0" />
            </svg>
            {/* Notification dot */}
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
          </button>

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
