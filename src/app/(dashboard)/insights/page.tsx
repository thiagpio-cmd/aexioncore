"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";

const impactConfig: Record<string, { color: string; bg: string }> = {
  high: { color: "text-danger", bg: "bg-danger-light" },
  medium: { color: "text-warning", bg: "bg-warning-light" },
  low: { color: "text-muted", bg: "bg-gray-100" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  engagement: { label: "Engagement", color: "bg-blue-100 text-blue-700" },
  pipeline: { label: "Pipeline", color: "bg-purple-100 text-purple-700" },
  risk: { label: "Risk", color: "bg-red-100 text-red-700" },
  execution: { label: "Execution", color: "bg-orange-100 text-orange-700" },
  forecast: { label: "Forecast", color: "bg-amber-100 text-amber-700" },
  pattern: { label: "Pattern", color: "bg-teal-100 text-teal-700" },
  performance: { label: "Performance", color: "bg-indigo-100 text-indigo-700" },
};

export default function InsightsPage() {
  const { data, loading } = useApi<any[]>("/api/insights");
  const items = data || [];
  const [category, setCategory] = useState("all");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Insights" subtitle="No insights available" />
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">No insights found.</p>
        </div>
      </div>
    );
  }

  const filtered = category === "all" ? items : items.filter((i) => i.category === category);
  const highCount = items.filter((i) => i.impact?.toLowerCase() === "high").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Insights" subtitle={`${highCount} high-impact insights requiring attention`} />
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCategory("all")} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${category === "all" ? "bg-primary text-white" : "bg-surface border border-border text-muted hover:text-foreground"}`}>All</button>
        {Object.entries(categoryConfig).map(([key, cfg]) => (
          <button key={key} onClick={() => setCategory(key)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${category === key ? "bg-primary text-white" : "bg-surface border border-border text-muted hover:text-foreground"}`}>{cfg.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((insight) => {
          const impactKey = insight.impact?.toLowerCase() || "medium";
          const imp = impactConfig[impactKey] || impactConfig.medium;
          const cat = categoryConfig[insight.category] || { label: insight.category, color: "bg-gray-100 text-gray-700" };
          const relatedName = insight.lead?.name || insight.opportunity?.title || "";
          return (
            <div key={insight.id} className="rounded-xl border border-border bg-surface p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>{cat.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${imp.bg} ${imp.color}`}>{(insight.impact || "MEDIUM").toUpperCase()} IMPACT</span>
                </div>
                <span className="text-xs text-muted">{insight.confidence}% confidence</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{insight.title}</h3>
              <p className="text-xs text-muted leading-relaxed mb-3">{insight.description}</p>
              <div className="rounded-lg bg-primary-light p-3 mb-3">
                <p className="text-xs font-medium text-primary mb-0.5">💡 Suggested Action</p>
                <p className="text-xs text-foreground/80">{insight.suggestedAction}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted">Source: {insight.source || "AI"}{relatedName ? ` · ${relatedName}` : ""}</p>
                <button className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover transition-colors">Take Action</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
