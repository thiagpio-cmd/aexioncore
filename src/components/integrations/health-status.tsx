"use client";

type HealthStatus =
  | "healthy"
  | "degraded"
  | "stale"
  | "failed"
  | "reconnect_required"
  | "misconfigured";

interface HealthStatusProps {
  status: HealthStatus | string;
  healthPercent?: number;
  lastSuccessfulSync?: string | null;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { dot: string; label: string; bg: string; text: string; pulse?: boolean }
> = {
  healthy: {
    dot: "bg-emerald-500",
    label: "Healthy",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  degraded: {
    dot: "bg-yellow-500",
    label: "Degraded",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
  },
  stale: {
    dot: "bg-orange-500",
    label: "Stale",
    bg: "bg-orange-50",
    text: "text-orange-700",
  },
  failed: {
    dot: "bg-red-500",
    label: "Failed",
    bg: "bg-red-50",
    text: "text-red-700",
  },
  reconnect_required: {
    dot: "bg-red-500",
    label: "Reconnect Required",
    bg: "bg-red-50",
    text: "text-red-700",
    pulse: true,
  },
  misconfigured: {
    dot: "bg-gray-400",
    label: "Not Configured",
    bg: "bg-gray-100",
    text: "text-gray-600",
  },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

export function HealthStatusBadge({ status, compact }: { status: string; compact?: boolean }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.misconfigured;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${config.pulse ? "animate-pulse" : ""}`}
      />
      {!compact && config.label}
    </span>
  );
}

export function HealthStatusCard({
  status,
  healthPercent,
  lastSuccessfulSync,
}: HealthStatusProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.misconfigured;
  const pct = typeof healthPercent === "number" ? healthPercent : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Health Status</h3>

      <div className="flex items-center gap-3 mb-4">
        <HealthStatusBadge status={status} />
      </div>

      {/* Health percent bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted">Health Score</span>
          <span className="text-xs font-semibold text-foreground">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-background overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 80
                ? "bg-emerald-500"
                : pct >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Last successful sync */}
      {lastSuccessfulSync && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Last Successful Sync</span>
          <span className="text-xs font-medium text-foreground">
            {relativeTime(lastSuccessfulSync)}
          </span>
        </div>
      )}

      {!lastSuccessfulSync && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Last Successful Sync</span>
          <span className="text-xs text-muted">Never</span>
        </div>
      )}
    </div>
  );
}
