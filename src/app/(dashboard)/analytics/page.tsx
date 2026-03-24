"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";
import { formatCurrency, cn } from "@/lib/utils";

type Tab = "overview" | "pipeline" | "leads" | "team";

const STAGE_COLORS: Record<string, string> = {
  DISCOVERY: "bg-blue-500",
  QUALIFICATION: "bg-indigo-500",
  PROPOSAL: "bg-purple-500",
  NEGOTIATION: "bg-amber-500",
};

const TEMP_COLORS: Record<string, string> = {
  HOT: "bg-red-500",
  WARM: "bg-amber-500",
  COLD: "bg-blue-400",
};

type Period = "7d" | "30d" | "90d" | "365d" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "365d", label: "1 year" },
  { key: "all", label: "All time" },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [teamFilter, setTeamFilter] = useState("all");
  const { data, loading } = useApi<any>(`/api/analytics?period=${period}`);
  const { data: teams } = useApi<any[]>("/api/teams");
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" subtitle="Loading..." />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" subtitle="No data available" />
        <div className="flex items-center justify-center h-64 text-muted text-sm">Unable to load analytics data</div>
      </div>
    );
  }

  const s = data.summary || {};
  const forecast = data.forecast || {};
  const monthly = data.monthlyRevenue || [];
  const leadsByStatus = data.leadsByStatus || [];
  const leadsBySource = data.leadsBySource || [];
  const leadsByTemp = data.leadsByTemperature || [];
  const pipeline = data.pipelineByStage || [];
  const reps = data.repPerformance || [];
  const activityTypes = data.activityByType || [];

  const maxMonthlyWon = Math.max(...monthly.map((m: any) => m.won), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Revenue intelligence and performance metrics"
        actions={
          <div className="flex items-center gap-3">
            {/* Team Filter */}
            {teams && teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                <option value="all">All Teams</option>
                {teams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {/* Period Filter */}
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    period === p.key ? "bg-primary text-white shadow-sm" : "text-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Tab Selector */}
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {(["overview", "pipeline", "leads", "team"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                    tab === t ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Export */}
            <div className="relative group">
              <button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors">
                ↓ Export
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-20 rounded-lg border border-border bg-surface shadow-lg py-1 min-w-[140px]">
                <a href="/api/export?type=leads" download className="block px-3 py-1.5 text-xs text-foreground hover:bg-background transition-colors">Export Leads</a>
                <a href="/api/export?type=opportunities" download className="block px-3 py-1.5 text-xs text-foreground hover:bg-background transition-colors">Export Deals</a>
                <a href="/api/export?type=contacts" download className="block px-3 py-1.5 text-xs text-foreground hover:bg-background transition-colors">Export Contacts</a>
              </div>
            </div>
          </div>
        }
      />

      {tab === "overview" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Revenue", value: formatCurrency(s.totalRevenue || 0, "USD"), sub: `${s.winRate || 0}% win rate`, color: "text-success" },
              { label: "Active Pipeline", value: formatCurrency(s.totalPipeline || 0, "USD"), sub: `${s.totalDeals || 0} deals`, color: "text-foreground" },
              { label: "Avg Deal Size", value: formatCurrency(s.avgDealSize || 0, "USD"), sub: "Won deals", color: "text-foreground" },
              { label: "Total Lost", value: formatCurrency(s.totalLost || 0, "USD"), sub: `${100 - (s.winRate || 0)}% loss rate`, color: "text-danger" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-surface p-5">
                <p className="text-xs text-muted mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Forecast */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Forecast</h3>
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: "Commit", value: forecast.commit || 0, desc: "Probability >= 70%", color: "bg-success" },
                { label: "Best Case", value: forecast.bestCase || 0, desc: "Probability >= 40%", color: "bg-primary" },
                { label: "Weighted", value: forecast.weighted || 0, desc: "Value x Probability", color: "bg-purple-500" },
              ].map((f) => (
                <div key={f.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-2 w-2 rounded-full ${f.color}`} />
                    <span className="text-xs font-medium text-muted">{f.label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(f.value, "USD")}</p>
                  <p className="text-[11px] text-muted mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Revenue Chart (bar chart via CSS) */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Revenue Trend</h3>
            <div className="flex items-end gap-3 h-48">
              {monthly.map((m: any) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-foreground">
                    {m.won > 0 ? `$${(m.won / 1000).toFixed(0)}K` : ""}
                  </span>
                  <div className="w-full flex flex-col gap-0.5" style={{ height: "160px" }}>
                    <div className="flex-1" />
                    {m.lost > 0 && (
                      <div
                        className="w-full rounded-t bg-danger/30"
                        style={{ height: `${Math.max((m.lost / maxMonthlyWon) * 100, 4)}%` }}
                      />
                    )}
                    <div
                      className="w-full rounded-t bg-success"
                      style={{ height: `${Math.max((m.won / maxMonthlyWon) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{m.month}</span>
                  <span className="text-[10px] text-muted">{m.created} new</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-success" /><span className="text-[10px] text-muted">Won</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-danger/30" /><span className="text-[10px] text-muted">Lost</span></div>
            </div>
          </div>

          {/* Activity Breakdown + Task Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Activity Breakdown</h3>
              <div className="space-y-3">
                {activityTypes.map((a: any) => {
                  const maxCount = Math.max(...activityTypes.map((x: any) => x.count), 1);
                  return (
                    <div key={a.type}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-foreground">{a.type}</span>
                        <span className="text-sm font-medium text-foreground">{a.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-background">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(a.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {activityTypes.length === 0 && <p className="text-xs text-muted">No activities recorded</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Task Metrics</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{s.completedTasks || 0}</p>
                  <p className="text-xs text-muted">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{s.pendingTasks || 0}</p>
                  <p className="text-xs text-muted">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-danger">{s.overdueTasks || 0}</p>
                  <p className="text-xs text-muted">Overdue</p>
                </div>
              </div>
              <div className="h-3 rounded-full bg-background flex overflow-hidden">
                {s.completedTasks > 0 && <div className="bg-success" style={{ width: `${(s.completedTasks / Math.max(s.completedTasks + s.pendingTasks + s.overdueTasks, 1)) * 100}%` }} />}
                {s.pendingTasks > 0 && <div className="bg-primary/50" style={{ width: `${(s.pendingTasks / Math.max(s.completedTasks + s.pendingTasks + s.overdueTasks, 1)) * 100}%` }} />}
                {s.overdueTasks > 0 && <div className="bg-danger" style={{ width: `${(s.overdueTasks / Math.max(s.completedTasks + s.pendingTasks + s.overdueTasks, 1)) * 100}%` }} />}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-muted">Total Leads</span><span className="font-medium text-foreground">{s.totalLeads || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted">Total Accounts</span><span className="font-medium text-foreground">{s.totalAccounts || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted">Total Activities</span><span className="font-medium text-foreground">{s.totalActivities || 0}</span></div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "pipeline" && (
        <>
          {/* Pipeline by Stage */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Pipeline by Stage</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {pipeline.map((p: any) => (
                <div key={p.stage} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${STAGE_COLORS[p.stage] || "bg-gray-400"}`} />
                    <span className="text-xs font-medium text-muted">{p.stage}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{p.count}</p>
                  <p className="text-sm text-muted">{formatCurrency(p.value, "USD")}</p>
                  <p className="text-[11px] text-muted mt-1">Avg prob: {p.avgProbability}%</p>
                </div>
              ))}
            </div>

            {/* Pipeline funnel visualization */}
            <div className="space-y-2">
              {pipeline.map((p: any) => {
                const maxValue = Math.max(...pipeline.map((x: any) => x.value), 1);
                const pct = (p.value / maxValue) * 100;
                return (
                  <div key={p.stage} className="flex items-center gap-4">
                    <span className="w-28 text-sm text-foreground">{p.stage}</span>
                    <div className="flex-1 h-8 rounded bg-background flex items-center">
                      <div
                        className={`h-8 rounded flex items-center justify-end px-3 ${STAGE_COLORS[p.stage] || "bg-gray-400"}`}
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-xs font-medium text-white">{formatCurrency(p.value, "USD")}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted w-16 text-right">{p.count} deals</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Forecast Details */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Commit Forecast", value: forecast.commit || 0, desc: "Deals with >= 70% probability", color: "border-success" },
              { label: "Best Case", value: forecast.bestCase || 0, desc: "Deals with >= 40% probability", color: "border-primary" },
              { label: "Weighted Pipeline", value: forecast.weighted || 0, desc: "Sum of (value x probability)", color: "border-purple-500" },
            ].map((f) => (
              <div key={f.label} className={`rounded-xl border-l-4 ${f.color} border border-border bg-surface p-5`}>
                <p className="text-xs text-muted mb-1">{f.label}</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(f.value, "USD")}</p>
                <p className="text-[11px] text-muted mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "leads" && (
        <>
          {/* Lead Funnel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Lead Funnel</h3>
              <div className="space-y-2">
                {leadsByStatus.map((l: any) => {
                  const maxCount = Math.max(...leadsByStatus.map((x: any) => x.count), 1);
                  const pct = (l.count / maxCount) * 100;
                  const colors: Record<string, string> = {
                    NEW: "bg-blue-500", CONTACTED: "bg-indigo-500", QUALIFIED: "bg-purple-500",
                    UNQUALIFIED: "bg-gray-400", CONVERTED: "bg-success",
                  };
                  return (
                    <div key={l.status}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-foreground">{l.status}</span>
                        <span className="text-sm font-medium text-foreground">{l.count}</span>
                      </div>
                      <div className="h-6 rounded bg-background flex items-center">
                        <div
                          className={`h-6 rounded ${colors[l.status] || "bg-primary"}`}
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">By Temperature</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {leadsByTemp.map((t: any) => (
                  <div key={t.temperature} className="text-center rounded-xl border border-border bg-background p-4">
                    <div className={`mx-auto mb-2 h-3 w-3 rounded-full ${TEMP_COLORS[t.temperature] || "bg-gray-400"}`} />
                    <p className="text-2xl font-bold text-foreground">{t.count}</p>
                    <p className="text-xs text-muted">{t.temperature}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-3 mt-6">By Source</h3>
              <div className="space-y-2">
                {leadsBySource.map((l: any) => (
                  <div key={l.source} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5">
                    <span className="text-sm text-foreground">{l.source}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted">{l.count} leads</span>
                      <span className="text-sm font-medium text-foreground">{l.conversionRate}% conv.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "team" && (
        <>
          {/* Rep Performance Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Team Performance</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted">Rep</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Pipeline</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Won</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Lost</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Win Rate</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reps.map((r: any) => (
                  <tr key={r.name} className="hover:bg-background/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-foreground">{r.name}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-success">{formatCurrency(r.revenue, "USD")}</td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">{formatCurrency(r.pipeline, "USD")}</td>
                    <td className="px-5 py-3 text-right text-sm text-success">{r.won}</td>
                    <td className="px-5 py-3 text-right text-sm text-danger">{r.lost}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn("text-sm font-medium", r.winRate >= 50 ? "text-success" : r.winRate >= 30 ? "text-warning" : "text-danger")}>
                        {r.winRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-muted">{r.leads}</td>
                  </tr>
                ))}
                {reps.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">No team data available</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rep Revenue Comparison */}
          {reps.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Rep</h3>
              <div className="space-y-3">
                {reps.map((r: any) => {
                  const maxRev = Math.max(...reps.map((x: any) => x.revenue), 1);
                  return (
                    <div key={r.name} className="flex items-center gap-4">
                      <span className="w-28 text-sm text-foreground truncate">{r.name}</span>
                      <div className="flex-1 h-6 rounded bg-background">
                        <div
                          className="h-6 rounded bg-success flex items-center justify-end px-2"
                          style={{ width: `${Math.max((r.revenue / maxRev) * 100, 5)}%` }}
                        >
                          {r.revenue > 0 && <span className="text-[10px] font-medium text-white">{formatCurrency(r.revenue, "USD")}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted w-12 text-right">{r.winRate}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
