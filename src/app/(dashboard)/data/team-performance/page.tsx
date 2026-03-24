"use client";

import { useApi } from "@/lib/hooks/use-api";
import type { RepPerformance, AllMetrics } from "@/lib/metrics/business-metrics-engine";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function TeamPerformancePage() {
  const { data, loading } = useApi<AllMetrics>("/api/metrics?period=90");
  const reps = data?.repPerformance ?? [];
  const volume = data?.volume;
  const conversion = data?.conversion;

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold">Team Performance</h1></div>
        <div className="flex items-center justify-center py-20 text-muted">Loading metrics...</div>
      </div>
    );
  }

  const totalRevenue = reps.reduce((s, r) => s + r.revenue, 0);
  const totalPipeline = reps.reduce((s, r) => s + r.pipeline, 0);
  const totalActivities = reps.reduce((s, r) => s + r.totalActivities, 0);
  const avgWinRate = reps.length > 0
    ? Math.round(reps.reduce((s, r) => s + r.winRate, 0) / reps.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Team Performance</h1>
        <p className="text-sm text-muted mt-1">Rep-level volume, conversion, and productivity analysis (last 90 days)</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Total Revenue</p>
          <p className="text-xl font-bold text-foreground">{fmt(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Active Pipeline</p>
          <p className="text-xl font-bold text-foreground">{fmt(totalPipeline)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Avg Win Rate</p>
          <p className="text-xl font-bold text-foreground">{avgWinRate}%</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Total Activities</p>
          <p className="text-xl font-bold text-foreground">{totalActivities}</p>
        </div>
      </div>

      {/* Rep Performance Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold">Rep Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Rep</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Role</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Leads</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Converted</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Conv %</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Deals</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Won</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Win %</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Pipeline</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Activities</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Avg Cycle</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Overdue</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Stalled</th>
              </tr>
            </thead>
            <tbody>
              {reps.map(rep => (
                <tr key={rep.id} className="border-b border-border hover:bg-background/30">
                  <td className="px-4 py-3 font-medium text-foreground">{rep.name}</td>
                  <td className="px-4 py-3 text-muted">{rep.role}</td>
                  <td className="px-4 py-3 text-right">{rep.leadsOwned}</td>
                  <td className="px-4 py-3 text-right">{rep.leadsConverted}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={rep.leadConversionRate >= 20 ? "text-green-600" : rep.leadConversionRate > 0 ? "text-yellow-600" : "text-muted"}>
                      {rep.leadConversionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{rep.dealsOwned}</td>
                  <td className="px-4 py-3 text-right">{rep.dealsWon}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={rep.winRate >= 40 ? "text-green-600" : rep.winRate > 0 ? "text-yellow-600" : "text-muted"}>
                      {rep.winRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(rep.revenue)}</td>
                  <td className="px-4 py-3 text-right">{fmt(rep.pipeline)}</td>
                  <td className="px-4 py-3 text-right">{rep.totalActivities}</td>
                  <td className="px-4 py-3 text-right">{rep.avgCycleDays > 0 ? `${rep.avgCycleDays}d` : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {rep.overdueTasks > 0 && <span className="text-red-600 font-medium">{rep.overdueTasks}</span>}
                    {rep.overdueTasks === 0 && <span className="text-muted">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rep.stalledDeals > 0 && <span className="text-amber-600 font-medium">{rep.stalledDeals}</span>}
                    {rep.stalledDeals === 0 && <span className="text-muted">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold mb-3">Activity by Type</h3>
          <div className="space-y-2">
            {["calls", "emails", "meetings"].map(type => {
              const total = reps.reduce((s, r) => s + (r as any)[type], 0);
              return (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm capitalize text-muted">{type}</span>
                  <span className="text-sm font-medium">{total}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold mb-3">Conversion Funnel</h3>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted">Prospect → SAL</span><span className="text-sm font-medium">{conversion?.prospectToSal ?? 0}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted">SAL → SQL</span><span className="text-sm font-medium">{conversion?.salToSql ?? 0}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted">Lead → Opportunity</span><span className="text-sm font-medium">{conversion?.lto ?? 0}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted">Opportunity → Close</span><span className="text-sm font-medium">{conversion?.otc ?? 0}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted">Global Conversion</span><span className="text-sm font-medium">{conversion?.globalConversion ?? 0}%</span></div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted">Metrics computed from database. Assumptions: MQL = fitScore ≥ 60, SAL = CONTACTED, SQL = QUALIFIED. Period: last 90 days.</p>
    </div>
  );
}
