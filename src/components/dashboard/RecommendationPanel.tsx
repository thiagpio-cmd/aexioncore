"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";

interface Recommendation {
  id: string;
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  reasoning: string;
  entityType: string;
  entityId: string;
  entityName: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  actionLabel: string;
  actionUrl: string;
  suggestedDueDate?: string;
}

interface RecommendationsData {
  recommendations: Recommendation[];
  total: number;
}

interface RecommendationPanelProps {
  entityType?: string;
  entityId?: string;
  maxItems?: number;
  title?: string;
  compact?: boolean;
}

const priorityConfig: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-danger/10", text: "text-danger" },
  medium: { bg: "bg-warning/10", text: "text-warning" },
  low: { bg: "bg-primary/10", text: "text-primary" },
};

const impactConfig: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-emerald-50", text: "text-emerald-700" },
  medium: { bg: "bg-amber-50", text: "text-amber-700" },
  low: { bg: "bg-gray-100", text: "text-gray-600" },
};

const effortConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700" },
  medium: { bg: "bg-amber-50", text: "text-amber-700" },
  high: { bg: "bg-red-50", text: "text-red-700" },
};

function SkeletonRow() {
  return (
    <div className="bg-background border border-border rounded-lg p-3 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div className="h-4 w-2/3 rounded bg-border" />
        <div className="h-4 w-12 rounded-full bg-border" />
      </div>
      <div className="h-3 w-full rounded bg-border mb-1.5" />
      <div className="h-3 w-1/2 rounded bg-border" />
    </div>
  );
}

export function RecommendationPanel({
  entityType,
  entityId,
  maxItems = 5,
  title: panelTitle = "Recommended Actions",
  compact = false,
}: RecommendationPanelProps) {
  // Build URL: entity-scoped or global
  const params = new URLSearchParams();
  if (entityType) params.set("entityType", entityType);
  if (entityId) params.set("entityId", entityId);
  params.set("limit", String(maxItems));
  const url = `/api/recommendations?${params.toString()}`;

  const { data, loading } = useApi<RecommendationsData>(url);

  const recommendations = data?.recommendations ?? [];

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-6">
        <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          {panelTitle}
        </h3>
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-6">
      <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        {panelTitle}
      </h3>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const priority = priorityConfig[rec.priority] ?? priorityConfig.low;
          const impact = impactConfig[rec.impact] ?? impactConfig.medium;
          const effort = effortConfig[rec.effort] ?? effortConfig.medium;

          return (
            <div key={rec.id} className="bg-background border border-border rounded-lg p-3">
              {/* Header: title + priority */}
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-sm text-foreground">{rec.title}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ml-2 ${priority.bg} ${priority.text}`}
                >
                  {rec.priority}
                </span>
              </div>

              {/* Description */}
              {!compact && rec.description && (
                <p className="text-xs text-foreground/80 mb-1.5">{rec.description}</p>
              )}

              {/* Reasoning */}
              {rec.reasoning && (
                <p className="text-xs text-muted flex items-start gap-1 mb-2">
                  <span className="text-primary font-mono text-[10px] uppercase inline-block pt-[1px] opacity-70 shrink-0">
                    Why:
                  </span>
                  <span className="leading-relaxed">{rec.reasoning}</span>
                </p>
              )}

              {/* Metadata pills */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {/* Confidence */}
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {Math.round(rec.confidence * 100)}% confidence
                </span>
                {/* Impact */}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${impact.bg} ${impact.text}`}
                >
                  {rec.impact} impact
                </span>
                {/* Effort */}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${effort.bg} ${effort.text}`}
                >
                  {rec.effort} effort
                </span>
              </div>

              {/* CTA */}
              {rec.actionLabel && rec.actionUrl && (
                <Link
                  href={rec.actionUrl}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                >
                  {rec.actionLabel}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted mt-3 pt-3 border-t border-primary/10">
        AI-powered recommendations based on entity signals and historical patterns.
      </p>
    </div>
  );
}
