"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { useApi } from "@/lib/hooks/use-api";
import { NAV_SECTIONS } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";
import { AlertBadge } from "@/components/shared/alert-badge";
import { GlobalSearch } from "@/components/shared/global-search";
import { WorkspaceSwitcher } from "./workspace-switcher";

const iconPaths: Record<string, React.ReactNode> = {
  home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />,
  inbox: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />,
  "check-square": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
  building: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  briefcase: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  "git-branch": <><circle cx="18" cy="18" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" /><circle cx="6" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 21V9a9 9 0 009 9h0" /></>,
  lightbulb: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  "trending-up": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
  "bar-chart": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  "pie-chart": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />,
  "book-open": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  plug: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  settings: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
  heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  cpu: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />,
  droplet: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />,
  key: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
  "git-merge": <><circle cx="18" cy="18" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" /><circle cx="6" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 21V9a9 9 0 009 9h0" /></>,
  clipboard: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  "file-plus": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  "file-text": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  download: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
  "shield-alert": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  "trending-down": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />,
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="shrink-0"
    >
      {iconPaths[name] || iconPaths.home}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const activeRef = useRef<HTMLLIElement | null>(null);
  const { data: alertData } = useApi<{
    alerts: { id: string; type: string; severity: "critical" | "warning" | "info"; title: string }[];
    summary: { critical: number; warning: number; info: number; total: number };
  }>("/api/alerts");

  const alertBadges = useMemo(() => {
    if (!alertData?.alerts) return {};
    const counts: Record<string, { count: number; severity: "critical" | "warning" | "info" }> = {};

    const taskAlerts = alertData.alerts.filter((a) => a.type === "OVERDUE_TASK");
    if (taskAlerts.length > 0) {
      counts["Tasks"] = { count: taskAlerts.length, severity: "critical" };
    }

    const leadAlerts = alertData.alerts.filter((a) => a.type === "STALE_LEAD");
    if (leadAlerts.length > 0) {
      counts["Leads"] = { count: leadAlerts.length, severity: "warning" };
    }

    const oppAlerts = alertData.alerts.filter(
      (a) => a.type === "STUCK_DEAL" || a.type === "AT_RISK_DEAL"
    );
    if (oppAlerts.length > 0) {
      counts["Opportunities"] = { count: oppAlerts.length, severity: "warning" };
    }

    return counts;
  }, [alertData]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pathname]);

  const { org, isModuleEnabled } = useOrg();

  if (!user) return null;

  const sections = NAV_SECTIONS.map((section) => {
    // Filter entire section if its moduleKey is disabled
    const sectionModule = (section as any).moduleKey;
    if (sectionModule && !isModuleEnabled(sectionModule)) return null;

    return {
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles.includes(user.role)) return false;
        // Filter individual items by moduleKey
        const itemModule = (item as any).moduleKey;
        if (itemModule && !isModuleEnabled(itemModule)) return false;
        return true;
      }),
    };
  }).filter((section): section is NonNullable<typeof section> => section !== null && section.items.length > 0);

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border/60 bg-surface shadow-sm">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border/40">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: org.primaryColor || "#2457FF" }}
        >
          {org.logoUrl ? (
            <img src={org.logoUrl} alt="" className="h-5 w-5 object-contain" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <path d="M16 7L23 12V20L16 25L9 20V12L16 7Z" fill="white" fillOpacity="0.9" />
              <path d="M16 12L19.5 14.5V19L16 21.5L12.5 19V14.5L16 12Z" fill={org.primaryColor || "#2457FF"} />
            </svg>
          )}
        </div>
        <span className="text-lg tracking-tight">
          <span className="font-bold text-foreground">{org.displayName || org.name || "Aexion"}</span>{" "}
          {!org.displayName && <span className="font-normal text-muted">Core</span>}
        </span>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3">
        <WorkspaceSwitcher />
      </div>

      {/* Global Search */}
      <div className="px-3 pb-2">
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <NavSections
        sections={sections}
        pathname={pathname}
        activeRef={activeRef}
        alertBadges={alertBadges}
      />

      {/* Alerts Summary */}
      {alertData?.summary && alertData.summary.total > 0 && (
        <div className="px-3 pb-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span>{alertData.summary.total} alert{alertData.summary.total !== 1 ? "s" : ""}</span>
            <span className="ml-auto flex items-center gap-1">
              {alertData.summary.critical > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {alertData.summary.critical}
                </span>
              )}
              {alertData.summary.warning > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white">
                  {alertData.summary.warning}
                </span>
              )}
              {alertData.summary.info > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                  {alertData.summary.info}
                </span>
              )}
            </span>
          </Link>
        </div>
      )}

      {/* User Section */}
      <div className="border-t border-border/40 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-background/60 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-muted hover:bg-sidebar-hover hover:text-foreground transition-colors"
            title="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Collapsible Navigation ─────────────────────────────────────────────────
const ALWAYS_EXPANDED = new Set<string>();

function NavSections({
  sections,
  pathname,
  activeRef,
  alertBadges,
}: {
  sections: { title: string; items: { label: string; href: string; icon: string; roles: any[] }[] }[];
  pathname: string;
  activeRef: React.RefObject<HTMLLIElement | null>;
  alertBadges: Record<string, { count: number; severity: "critical" | "warning" | "info" }>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set(["Operation"]);
    for (const s of sections) {
      if (s.items.some(i => i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) {
        initial.add(s.title);
      }
    }
    return initial;
  });

  useEffect(() => {
    for (const s of sections) {
      if (s.items.some(i => i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) {
        setExpanded(prev => new Set([...prev, s.title]));
      }
    }
  }, [pathname, sections]);

  const toggle = useCallback((title: string) => {
    if (ALWAYS_EXPANDED.has(title)) return;
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-1">
      {sections.map((section, idx) => {
        const isOpen = expanded.has(section.title) || ALWAYS_EXPANDED.has(section.title);
        const collapsible = !ALWAYS_EXPANDED.has(section.title);
        const hasActive = section.items.some(i =>
          i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
        );

        return (
          <div key={section.title} className={cn("mb-1", idx === 0 && "mt-2")}>
            <button
              onClick={() => toggle(section.title)}
              className={cn(
                "w-full mb-1 px-3 py-1.5 flex items-center gap-2 rounded-md transition-colors",
                collapsible && "hover:bg-sidebar-hover cursor-pointer",
                !collapsible && "cursor-default",
                hasActive && !isOpen && "text-primary"
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 flex-1 text-left select-none">
                {section.title}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                className={cn("text-muted/40 transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isOpen && (
              <ul className="space-y-0.5 mb-3">
                {section.items.map((item) => {
                  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <li key={item.href} ref={isActive ? activeRef : undefined}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary/[0.08] text-primary shadow-[inset_2px_0_0_0] shadow-primary"
                            : "text-muted/80 hover:bg-background/80 hover:text-foreground"
                        )}
                      >
                        <NavIcon name={item.icon} />
                        {item.label}
                        {alertBadges[item.label] ? (
                          <AlertBadge count={alertBadges[item.label].count} severity={alertBadges[item.label].severity} />
                        ) : (item as any).badge !== undefined ? (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
                            {(item as any).badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
