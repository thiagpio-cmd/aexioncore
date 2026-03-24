"use client";

import Link from "next/link";

export interface RecommendationCardProps {
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  actionLabel: string;
  actionUrl: string;
  entityType?: string;
  entityName?: string;
  priority: "high" | "medium" | "low";
  compact?: boolean;
}

const priorityIndicator: Record<string, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-primary",
};

const impactStyles: Record<string, string> = {
  high: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted/10 text-muted",
};

const effortStyles: Record<string, string> = {
  low: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
};

export function RecommendationCard({
  title,
  description,
  reasoning,
  confidence,
  impact,
  effort,
  actionLabel,
  actionUrl,
  entityType,
  entityName,
  priority,
  compact = false,
}: RecommendationCardProps) {
  if (compact) {
    return (
      <div className="relative flex items-start gap-2.5 rounded-lg border border-border bg-background p-3 hover:border-primary/30 transition-colors">
        {/* Priority dot */}
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${priorityIndicator[priority] || priorityIndicator.medium}`}
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground line-clamp-1">
            {title}
          </p>

          {entityName && (
            <p className="mt-0.5 text-[10px] text-muted">
              {entityType ? `${entityType}: ` : ""}
              {entityName}
            </p>
          )}

          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              {Math.round(confidence * 100)}%
            </span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${impactStyles[impact]}`}
            >
              {impact}
            </span>
          </div>
        </div>

        <Link
          href={actionUrl}
          className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
        >
          {actionLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-border bg-background p-4 hover:border-primary/30 transition-colors">
      {/* Priority indicator bar */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${priorityIndicator[priority] || priorityIndicator.medium}`}
      />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary shrink-0">
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>

        {description && (
          <p className="text-xs text-muted mb-2 line-clamp-2">{description}</p>
        )}

        {entityName && (
          <p className="text-xs font-medium text-foreground/70 mb-2">
            {entityType ? `${entityType}: ` : ""}
            {entityName}
          </p>
        )}

        {reasoning && (
          <p className="text-xs text-muted flex items-start gap-1.5 mb-2">
            <span className="text-primary font-mono text-[10px] uppercase inline-block pt-[1px] opacity-70">
              Because:
            </span>
            <span className="leading-relaxed">{reasoning}</span>
          </p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${impactStyles[impact]}`}
          >
            {impact} impact
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${effortStyles[effort]}`}
          >
            {effort} effort
          </span>
        </div>

        <Link
          href={actionUrl}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {actionLabel}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
