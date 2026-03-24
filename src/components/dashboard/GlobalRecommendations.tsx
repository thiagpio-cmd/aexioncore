"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

const priorityStyles: Record<string, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-warning/10 text-warning",
  low: "bg-primary/10 text-primary",
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

export function GlobalRecommendations() {
  const [data, setData] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecs() {
      try {
        const response = await fetch("/api/recommendations");
        if (!response.ok) return;
        const resJson = await response.json();
        setData(resJson.data.recommendations || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecs();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 animate-pulse">
        <div className="h-5 bg-border rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-border rounded mb-3"></div>
        <div className="h-20 bg-border rounded"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
      <h3 className="text-base font-bold text-primary flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Action Center
      </h3>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {data.map(rec => (
          <div key={rec.id} className="bg-background border border-border hover:border-primary/30 transition-colors rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-sm text-foreground">{rec.title}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${priorityStyles[rec.priority] || priorityStyles.medium}`}>
                {rec.priority}
              </span>
            </div>

            {rec.description && (
              <p className="text-xs text-muted mb-2 line-clamp-2">{rec.description}</p>
            )}

            {rec.entityName && (
              <div className="mb-2 text-xs font-medium">
                <Link href={rec.actionUrl} className="text-primary hover:underline">
                  {rec.entityType ? `${rec.entityType}: ` : ""}{rec.entityName}
                </Link>
              </div>
            )}

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {Math.round(rec.confidence * 100)}% confidence
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${impactStyles[rec.impact] || ""}`}>
                {rec.impact} impact
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${effortStyles[rec.effort] || ""}`}>
                {rec.effort} effort
              </span>
            </div>

            {rec.reasoning && (
              <p className="text-xs text-muted flex items-start gap-1.5 mb-3">
                <span className="text-primary font-mono text-[10px] uppercase inline-block pt-[1px] opacity-70">Because:</span>
                <span className="leading-relaxed">{rec.reasoning}</span>
              </p>
            )}

            <Link
              href={rec.actionUrl}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {rec.actionLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
