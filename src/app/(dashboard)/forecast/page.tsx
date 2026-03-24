"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";

type ViewMode = "overview" | "scenarios" | "gap";

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${(v / 1000).toFixed(0)}K`;
}

export default function ForecastPage() {
  const [view, setView] = useState<ViewMode>("overview");
  const { data, loading } = useApi<any[]>("/api/forecast");
  const items = data || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Forecast" subtitle="No forecast data available" />
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">No forecast snapshots found.</p>
        </div>
      </div>
    );
  }

  const totalCommit = items.reduce((s, f) => s + (f.commit || 0), 0);
  const totalBest = items.reduce((s, f) => s + (f.bestCase || 0), 0);
  const totalPipeline = items.reduce((s, f) => s + (f.pipeline || 0), 0);
  const totalTarget = items.reduce((s, f) => s + (f.target || 0), 0);
  const pipelineCoverage = totalTarget > 0 ? (totalPipeline / totalTarget).toFixed(1) : "0";

  // Group by quarter/year for display
  const latestSnapshot = items[0];
  const subtitle = latestSnapshot ? `Q${latestSnapshot.quarter} ${latestSnapshot.year} Revenue Forecast` : "Revenue Forecast";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecast"
        subtitle={subtitle}
        actions={
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            {(["overview", "scenarios", "gap"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                  view === v ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                )}
              >
                {v === "gap" ? "Gap Analysis" : v}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Commit" value={formatCurrency(totalCommit)} change={totalTarget > 0 ? `${((totalCommit / totalTarget) * 100).toFixed(0)}% of target` : "—"} changeType="neutral" />
        <StatCard label="Best Case" value={formatCurrency(totalBest)} change="Optimistic scenario" changeType="neutral" />
        <StatCard label="Pipeline" value={formatCurrency(totalPipeline)} change={`${pipelineCoverage}x coverage`} changeType="positive" />
        <StatCard label="Target" value={formatCurrency(totalTarget)} change="Quarterly goal" changeType="neutral" />
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Target Progress</h2>
        <div className="relative h-4 rounded-full bg-background overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-full bg-primary/30 transition-all" style={{ width: `${totalTarget > 0 ? Math.min((totalCommit / totalTarget) * 100, 100) : 0}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted">$0</span>
          <span className="text-xs text-muted">{formatCurrency(totalTarget)}</span>
        </div>
        <div className="flex gap-6 mt-3">
          <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-primary/30" /><span className="text-xs text-muted">Commit ({formatCurrency(totalCommit)})</span></div>
        </div>
      </div>

      {view === "overview" && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Forecast Snapshots</h2>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-border bg-background/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-muted">Period</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted">Target</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted">Commit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted">Best Case</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted">Pipeline</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted">Progress</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {items.map((f) => (
                <tr key={f.id} className="hover:bg-background/30 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-foreground">Q{f.quarter} {f.year}</td>
                  <td className="px-6 py-3.5 text-sm text-right text-muted">{formatCurrency(f.target || 0)}</td>
                  <td className="px-6 py-3.5 text-sm text-right text-foreground">{formatCurrency(f.commit || 0)}</td>
                  <td className="px-6 py-3.5 text-sm text-right text-muted">{formatCurrency(f.bestCase || 0)}</td>
                  <td className="px-6 py-3.5 text-sm text-right text-muted">{formatCurrency(f.pipeline || 0)}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="h-1.5 w-20 rounded-full bg-background"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${f.target > 0 ? Math.min((f.commit / f.target) * 100, 100) : 0}%` }} /></div>
                      <span className="text-xs text-muted">{f.target > 0 ? ((f.commit / f.target) * 100).toFixed(0) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "scenarios" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Conservative", desc: "Commit only (≥70% prob)", value: totalCommit, pct: totalTarget > 0 ? Math.round((totalCommit / totalTarget) * 100) : 0, color: "border-success", bg: "bg-success" },
              { label: "Moderate", desc: "Best case (≥40% prob)", value: totalBest, pct: totalTarget > 0 ? Math.round((totalBest / totalTarget) * 100) : 0, color: "border-primary", bg: "bg-primary" },
              { label: "Optimistic", desc: "Full pipeline", value: totalPipeline, pct: totalTarget > 0 ? Math.round((totalPipeline / totalTarget) * 100) : 0, color: "border-purple-500", bg: "bg-purple-500" },
            ].map((scenario) => (
              <div key={scenario.label} className={`rounded-xl border-l-4 ${scenario.color} border border-border bg-surface p-6`}>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">{scenario.label}</p>
                <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(scenario.value)}</p>
                <p className="text-xs text-muted mt-1">{scenario.desc}</p>
                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted">vs Target</span>
                    <span className={`text-xs font-medium ${scenario.pct >= 100 ? "text-success" : scenario.pct >= 70 ? "text-warning" : "text-danger"}`}>{scenario.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-background">
                    <div className={`h-2 rounded-full ${scenario.bg}`} style={{ width: `${Math.min(scenario.pct, 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Scenario Comparison Chart */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Scenario Comparison</h3>
            <div className="space-y-4">
              {[
                { label: "Target", value: totalTarget, color: "bg-border" },
                { label: "Conservative", value: totalCommit, color: "bg-success" },
                { label: "Moderate", value: totalBest, color: "bg-primary" },
                { label: "Optimistic", value: totalPipeline, color: "bg-purple-500" },
              ].map((bar) => {
                const maxVal = Math.max(totalPipeline, totalTarget, 1);
                return (
                  <div key={bar.label} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-foreground">{bar.label}</span>
                    <div className="flex-1 h-8 rounded bg-background">
                      <div
                        className={`h-8 rounded flex items-center justify-end px-3 ${bar.color}`}
                        style={{ width: `${Math.max((bar.value / maxVal) * 100, 5)}%` }}
                      >
                        <span className="text-xs font-medium text-white">{formatCurrency(bar.value)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === "gap" && (
        <div className="space-y-6">
          {/* Gap Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="text-xs text-muted mb-1">Revenue Gap (Commit)</p>
              <p className={`text-3xl font-bold ${totalCommit >= totalTarget ? "text-success" : "text-danger"}`}>
                {totalCommit >= totalTarget ? "+" : ""}{formatCurrency(totalCommit - totalTarget)}
              </p>
              <p className="text-xs text-muted mt-1">
                {totalCommit >= totalTarget ? "On track to exceed target" : "Need to close gap"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="text-xs text-muted mb-1">Pipeline Coverage</p>
              <p className={`text-3xl font-bold ${Number(pipelineCoverage) >= 3 ? "text-success" : Number(pipelineCoverage) >= 2 ? "text-warning" : "text-danger"}`}>
                {pipelineCoverage}x
              </p>
              <p className="text-xs text-muted mt-1">
                {Number(pipelineCoverage) >= 3 ? "Healthy coverage" : "Need more pipeline"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="text-xs text-muted mb-1">Deals Needed</p>
              <p className="text-3xl font-bold text-foreground">
                {totalCommit >= totalTarget ? 0 : Math.ceil((totalTarget - totalCommit) / Math.max(totalCommit / Math.max(items.length, 1), 50000))}
              </p>
              <p className="text-xs text-muted mt-1">At current avg deal size</p>
            </div>
          </div>

          {/* Action Items */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recommended Actions</h3>
            <div className="space-y-3">
              {totalCommit < totalTarget && (
                <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-light px-4 py-3">
                  <span className="text-danger text-lg mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Close Revenue Gap</p>
                    <p className="text-xs text-muted mt-0.5">
                      You need {formatCurrency(totalTarget - totalCommit)} more in committed deals to hit target.
                      Focus on advancing deals with 50-70% probability to commit status.
                    </p>
                  </div>
                </div>
              )}
              {Number(pipelineCoverage) < 3 && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning-light px-4 py-3">
                  <span className="text-warning text-lg mt-0.5">📊</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Increase Pipeline Coverage</p>
                    <p className="text-xs text-muted mt-0.5">
                      Pipeline coverage is {pipelineCoverage}x. Best practice is 3x or higher.
                      Generate {formatCurrency(totalTarget * 3 - totalPipeline)} more in pipeline.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-light px-4 py-3">
                <span className="text-primary text-lg mt-0.5">🎯</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Accelerate Key Deals</p>
                  <p className="text-xs text-muted mt-0.5">
                    Review deals in Negotiation stage for potential quick wins. Schedule closing calls this week.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3">
                <span className="text-muted text-lg mt-0.5">📈</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Optimize Win Rate</p>
                  <p className="text-xs text-muted mt-0.5">
                    Current win rate suggests room for improvement. Review lost deals for patterns and adjust playbooks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
