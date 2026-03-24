"use client";

import { useState, useCallback } from "react";
import { useApi } from "@/lib/hooks/use-api";

// ============================================================================
// Types
// ============================================================================

interface TimelineEvent {
  id: string;
  type: string;
  category: "communication" | "activity" | "system" | "milestone" | "task" | "meeting" | "alert";
  actor: { id: string; name: string; type: "user" | "system" | "integration" };
  subject: string;
  detail?: string;
  entityType: string;
  entityId: string;
  source: "manual" | "integration" | "system" | "automation";
  sourceProvider?: string;
  direction?: "inbound" | "outbound";
  channel?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

interface TimelineApiResponse {
  events: TimelineEvent[];
  total: number;
}

interface CanonicalTimelineProps {
  entityType: string;
  entityId: string;
  maxItems?: number;
  showFilters?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "communication", label: "Communication" },
  { key: "activity", label: "Activity" },
  { key: "task", label: "Tasks" },
  { key: "meeting", label: "Meetings" },
  { key: "milestone", label: "Milestones" },
  { key: "system", label: "System" },
] as const;

const CHANNEL_FILTERS = [
  { key: "all", label: "All" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "phone", label: "Phone" },
  { key: "internal", label: "Internal" },
] as const;

const EVENT_ICONS: Record<string, string> = {
  EMAIL_RECEIVED: "\u2709\uFE0F",
  EMAIL_SENT: "\u2709\uFE0F",
  WHATSAPP_RECEIVED: "\uD83D\uDCAC",
  WHATSAPP_SENT: "\uD83D\uDCAC",
  CALL_MADE: "\uD83D\uDCF1",
  CALL_RECEIVED: "\uD83D\uDCF1",
  SMS_SENT: "\uD83D\uDCF1",
  SMS_RECEIVED: "\uD83D\uDCF1",
  NOTE_ADDED: "\uD83D\uDCDD",
  ACTIVITY_LOGGED: "\uD83D\uDCCB",
  DOCUMENT_SHARED: "\uD83D\uDCC4",
  LEAD_CREATED: "\u2B50",
  LEAD_CONVERTED: "\uD83C\uDF89",
  STAGE_CHANGED: "\u27A1\uFE0F",
  DEAL_WON: "\uD83C\uDFC6",
  DEAL_LOST: "\u274C",
  CONTACT_CREATED: "\uD83D\uDC64",
  ACCOUNT_CREATED: "\uD83C\uDFE2",
  TASK_CREATED: "\u2705",
  TASK_COMPLETED: "\u2705",
  TASK_OVERDUE: "\u26A0\uFE0F",
  MEETING_SCHEDULED: "\uD83D\uDCC5",
  MEETING_COMPLETED: "\uD83D\uDCC5",
  MEETING_CANCELED: "\uD83D\uDCC5",
  INTEGRATION_SYNCED: "\u26A1",
  ALERT_TRIGGERED: "\uD83D\uDD14",
  RECOMMENDATION_GENERATED: "\uD83D\uDCA1",
  PLAYBOOK_APPLIED: "\uD83D\uDCD6",
  OWNER_CHANGED: "\uD83D\uDD04",
  ASSIGNMENT_CHANGED: "\uD83D\uDD04",
};

const CATEGORY_COLORS: Record<string, string> = {
  communication: "bg-blue-100 text-blue-700",
  activity: "bg-violet-100 text-violet-700",
  system: "bg-gray-100 text-gray-600",
  milestone: "bg-emerald-100 text-emerald-700",
  task: "bg-amber-100 text-amber-700",
  meeting: "bg-indigo-100 text-indigo-700",
  alert: "bg-red-100 text-red-700",
};

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  manual: { label: "Manual", className: "bg-background text-muted" },
  integration: { label: "Integration", className: "bg-primary-light text-primary" },
  system: { label: "System", className: "bg-gray-100 text-gray-600" },
  automation: { label: "Auto", className: "bg-violet-100 text-violet-700" },
};

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDirectionArrow(direction?: string): string | null {
  if (direction === "inbound") return "\u2193";
  if (direction === "outbound") return "\u2191";
  return null;
}

// ============================================================================
// Component
// ============================================================================

export function CanonicalTimeline({ entityType, entityId, maxItems, showFilters = false }: CanonicalTimelineProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = maxItems || 50;

  // Build URL with filters
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("entityType", entityType);
    params.set("entityId", entityId);
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    if (categoryFilter !== "all") params.set("categories", categoryFilter);
    if (channelFilter !== "all") {
      // Map display channel to actual channel values
      const channelMap: Record<string, string> = {
        email: "email",
        whatsapp: "whatsapp",
        phone: "call",
        internal: "internal",
      };
      params.set("channels", channelMap[channelFilter] || channelFilter);
    }
    return `/api/timeline?${params.toString()}`;
  }, [entityType, entityId, pageSize, page, categoryFilter, channelFilter]);

  const { data, loading, error } = useApi<TimelineApiResponse>(buildUrl());

  const events = data?.events || [];
  const total = data?.total || 0;
  const hasMore = (page + 1) * pageSize < total;

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="space-y-3">
          {/* Category filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setCategoryFilter(f.key); setPage(0); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === f.key
                    ? "bg-primary text-white"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Channel filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setChannelFilter(f.key); setPage(0); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  channelFilter === f.key
                    ? "bg-foreground text-white"
                    : "bg-background text-muted hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && events.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-background" />
                <div className="w-0.5 flex-1 bg-background mt-1" />
              </div>
              <div className="flex-1 space-y-2 pb-6">
                <div className="h-3 w-24 rounded bg-background" />
                <div className="h-4 w-3/4 rounded bg-background" />
                <div className="h-3 w-1/2 rounded bg-background" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
          Failed to load timeline: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background text-xl">
            {"\uD83D\uDCC5"}
          </div>
          <p className="text-sm font-medium text-foreground">No timeline events</p>
          <p className="mt-1 text-xs text-muted">
            Activity, messages, tasks, and meetings will appear here as they happen.
          </p>
        </div>
      )}

      {/* Timeline events */}
      {events.length > 0 && (
        <div className="relative">
          {events.map((event, index) => {
            const icon = EVENT_ICONS[event.type] || "\u25CF";
            const catColor = CATEGORY_COLORS[event.category] || "bg-gray-100 text-gray-600";
            const sourceBadge = SOURCE_BADGES[event.source] || SOURCE_BADGES.manual;
            const dirArrow = getDirectionArrow(event.direction);
            const isLast = index === events.length - 1;

            return (
              <div key={event.id} className="flex gap-3">
                {/* Timeline line + icon */}
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${catColor}`}>
                    {icon}
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 bg-border" />}
                </div>

                {/* Content */}
                <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                  {/* Top row: time + badges */}
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{formatRelativeTime(event.occurredAt)}</span>
                    {dirArrow && (
                      <span className={`font-bold ${event.direction === "inbound" ? "text-blue-500" : "text-emerald-500"}`}>
                        {dirArrow}
                      </span>
                    )}
                    {event.channel && event.channel !== "internal" && (
                      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">
                        {event.channel}
                      </span>
                    )}
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceBadge.className}`}>
                      {event.sourceProvider || sourceBadge.label}
                    </span>
                  </div>

                  {/* Subject */}
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {event.subject}
                  </p>

                  {/* Actor */}
                  <p className="mt-0.5 text-xs text-muted">
                    {event.actor.type === "system" ? "System" : event.actor.name}
                  </p>

                  {/* Detail (collapsed by default for long text) */}
                  {event.detail && (
                    <p className="mt-1 text-xs text-muted line-clamp-2">
                      {event.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            Load more ({total - (page + 1) * pageSize} remaining)
          </button>
        </div>
      )}

      {/* Loading more indicator */}
      {loading && events.length > 0 && (
        <div className="flex justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
