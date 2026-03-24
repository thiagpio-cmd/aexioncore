"use client";

import { useApi } from "@/lib/hooks/use-api";
import Link from "next/link";

interface Alert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  reasoning: string;
  entityType: string;
  entityId: string;
  entityName: string;
  ownerId?: string;
  ownerName?: string;
  actionLabel: string;
  actionUrl: string;
  triggerValue: number;
  threshold: number;
  createdAt: string;
  acknowledgedAt?: string;
}

interface AlertsData {
  alerts: Alert[];
  summary: { critical: number; warning: number; info: number; total: number };
}

interface AlertsPanelProps {
  maxItems?: number;
  filterType?: string;
  filterEntity?: string;
  compact?: boolean;
  title?: string;
}

const severityConfig: Record<
  string,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  critical: {
    bg: "bg-danger-light",
    text: "text-danger",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-warning-light",
    text: "text-warning",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    bg: "bg-primary-light",
    text: "text-primary",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse">
      <div className="h-8 w-8 rounded-lg bg-border" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-border" />
        <div className="h-3 w-1/2 rounded bg-border" />
      </div>
    </div>
  );
}

export function AlertsPanel({
  maxItems = 5,
  filterType,
  filterEntity,
  compact = false,
  title = "Alerts",
}: AlertsPanelProps) {
  const params = new URLSearchParams();
  if (filterType) params.set("type", filterType);
  if (filterEntity) params.set("entityType", filterEntity);
  const queryString = params.toString();
  const url = `/api/alerts/v2${queryString ? `?${queryString}` : ""}`;

  const { data, loading } = useApi<AlertsData>(url);

  const alerts = data?.alerts?.slice(0, maxItems) ?? [];
  const summary = data?.summary;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
        <div className="space-y-1">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>

      {/* Summary bar */}
      {summary && summary.total > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          {summary.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 font-medium text-danger">
              {summary.critical} critical
            </span>
          )}
          {summary.warning > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2 py-0.5 font-medium text-warning">
              {summary.warning} warning
            </span>
          )}
          {summary.info > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 font-medium text-primary">
              {summary.info} info
            </span>
          )}
        </div>
      )}

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-2 text-success"
          >
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-sm text-muted">
            No alerts &mdash; everything looks good!
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity] ?? severityConfig.info;
            return (
              <li key={alert.id}>
                <Link
                  href={alert.actionUrl}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-background ${compact ? "py-1.5" : ""}`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.text}`}
                  >
                    {config.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}
                    >
                      {alert.title}
                      {alert.ownerName && (
                        <span className="ml-1.5 text-muted font-normal">
                          &middot; {alert.ownerName}
                        </span>
                      )}
                    </p>
                    {!compact && alert.description && (
                      <p className="mt-0.5 text-xs text-muted line-clamp-2">
                        {alert.description}
                      </p>
                    )}
                    {!compact && alert.reasoning && (
                      <p className="mt-0.5 text-[11px] italic text-muted/70 line-clamp-1">
                        {alert.reasoning}
                      </p>
                    )}
                  </div>
                  {compact ? (
                    <span
                      className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text}`}
                    >
                      {alert.severity}
                    </span>
                  ) : (
                    <span className="mt-0.5 shrink-0 text-[11px] font-medium text-primary">
                      {alert.actionLabel || "View"}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
