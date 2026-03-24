"use client";

export interface TimelineEvent {
  id: string;
  type: string;
  channel?: string;
  subject?: string;
  body?: string;
  creator?: { id: string; name: string };
  createdAt: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  emptyMessage?: string;
}

const EVENT_COLORS: Record<string, string> = {
  EMAIL: "bg-indigo-100 text-indigo-600",
  CALL: "bg-emerald-100 text-emerald-600",
  NOTE: "bg-gray-100 text-gray-600",
  STAGE_CHANGE: "bg-amber-100 text-amber-600",
  WHATSAPP: "bg-green-100 text-green-600",
  MEETING: "bg-blue-100 text-blue-600",
  SYSTEM: "bg-gray-100 text-gray-400",
  MESSAGE: "bg-blue-100 text-blue-600",
};

const ICON_PATHS: Record<string, string> = {
  EMAIL:
    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 3l-8 5-8-5",
  CALL:
    "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z",
  NOTE:
    "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8",
  STAGE_CHANGE: "M5 12h14m-7-7l7 7-7 7",
  SYSTEM:
    "M12 15a3 3 0 100-6 3 3 0 000 6zM12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42",
  WHATSAPP:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z",
  MEETING:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  MESSAGE:
    "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TimelineIcon({ type }: { type: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[type] || ICON_PATHS.SYSTEM} />
    </svg>
  );
}

function SkeletonItem({ showLine }: { showLine: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-border/60" />
        {showLine && <div className="w-px flex-1 bg-border my-1" />}
      </div>
      <div className="flex-1 pb-6 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-32 animate-pulse rounded-md bg-border/60" />
          <div className="h-3 w-14 animate-pulse rounded-md bg-border/60" />
        </div>
        <div className="h-3 w-48 animate-pulse rounded-md bg-border/60" />
        <div className="h-2.5 w-20 animate-pulse rounded-md bg-border/60" />
      </div>
    </div>
  );
}

export function Timeline({
  events,
  loading = false,
  emptyMessage = "No activities yet",
}: TimelineProps) {
  if (loading) {
    return (
      <div className="space-y-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonItem key={i} showLine={i < 2} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted/40 mb-2"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <p className="text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${EVENT_COLORS[event.type] || "bg-gray-100 text-gray-400"}`}
            >
              <TimelineIcon type={event.type} />
            </div>
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-border my-1" />
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {event.subject || event.type}
              </p>
              <span className="text-xs text-muted">
                {formatRelativeTime(event.createdAt)}
              </span>
            </div>
            {event.body && (
              <p className="mt-0.5 text-sm text-muted">{event.body}</p>
            )}
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <span>{event.creator?.name || "System"}</span>
              {event.channel && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium">
                    {event.channel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
