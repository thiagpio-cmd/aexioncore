"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d" | "all";

function formatCurrency(v: number) {
  return `R$ ${(v / 1000).toFixed(0)}K`;
}

export default function DashboardsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const { data, loading, error } = useApi<any>("/api/dashboard");

  const objections = ["Budget constraints", "Timeline concern", "Integration complexity", "Already evaluating competitor", "Needs board approval"];

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboards" subtitle="Operational analytics and KPIs" />
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboards" subtitle="Operational analytics and KPIs" />
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted">{error || "No data available"}</div>
        </div>
      </div>
    );
  }

  const stats = data.stats || {};
  const stages = data.stages || [];
  const reps = data.reps || [];
  const channels = data.channels || [
    { name: "Inbound", leads: 4, conversion: "32%", color: "bg-primary" },
    { name: "Outbound", leads: 3, conversion: "18%", color: "bg-purple-500" },
    { name: "Referral", leads: 2, conversion: "45%", color: "bg-success" },
    { name: "Event", leads: 1, conversion: "22%", color: "bg-warning" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboards"
        subtitle="Operational analytics and KPIs"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {(["7d", "30d", "90d", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    period === p ? "bg-primary text-white shadow-sm" : "text-muted hover:text-foreground"
                  )}
                >
                  {p === "all" ? "All" : p}
                </button>
              ))}
            </div>
            <a
              href="/api/export?type=leads"
              download
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              ↓ Export
            </a>
          </div>
        }
      />
      <div className="grid grid-cols-6 gap-4">
        <StatCard label="Total Pipeline" value={formatCurrency(stats.totalPipeline || 0)} change="+18% QoQ" changeType="positive" />
        <StatCard label="Won Revenue" value={formatCurrency(stats.wonValue || 0)} change="This quarter" changeType="positive" />
        <StatCard label="Win Rate" value={`${stats.winRate || 0}%`} change="+4% vs last Q" changeType="positive" />
        <StatCard label="Avg Cycle" value={`${stats.avgCycle || 0}d`} change="-5 days" changeType="positive" />
        <StatCard label="Hot Leads" value={stats.hotLeads || 0} change="Ready to convert" changeType="positive" />
        <StatCard label="Overdue Tasks" value={stats.overdueTasks || 0} change="Needs attention" changeType="negative" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Volume by Stage */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pipeline by Stage</h3>
          <div className="space-y-3">
            {stages.map((s: any) => (
              <div key={s.stage}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-foreground">{s.stage}</span>
                  <span className="text-sm text-muted">{s.count} deals · {formatCurrency(s.value)}</span>
                </div>
                <div className="h-2 rounded-full bg-background"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min((s.value / 800000) * 100, 100)}%` }} /></div>
              </div>
            ))}
            {stages.length === 0 && <p className="text-xs text-muted">No stage data available</p>}
          </div>
        </div>

        {/* Channel Performance */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Performance by Channel</h3>
          <div className="space-y-3">
            {channels.map((ch: any) => (
              <div key={ch.name} className="flex items-center gap-4 rounded-lg border border-border px-4 py-3">
                <div className={`h-3 w-3 rounded-full ${ch.color || "bg-primary"}`} />
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">{ch.name}</span>
                </div>
                <span className="text-sm text-muted">{ch.leads} leads</span>
                <span className="text-sm font-medium text-foreground">{ch.conversion} conv.</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Activity by Rep */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Activity by Rep</h3></div>
          <table className="w-full">
            <thead><tr className="border-b border-border bg-background/50">
              <th className="px-6 py-2.5 text-left text-xs font-medium text-muted">Rep</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-muted">Role</th>
              <th className="px-6 py-2.5 text-right text-xs font-medium text-muted">Activities</th>
              <th className="px-6 py-2.5 text-right text-xs font-medium text-muted">Tasks</th>
              <th className="px-6 py-2.5 text-right text-xs font-medium text-muted">Leads</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {reps.map((r: any) => (
                <tr key={r.name} className="hover:bg-background/30">
                  <td className="px-6 py-3 text-sm font-medium text-foreground">{r.name}</td>
                  <td className="px-6 py-3 text-xs text-muted">{r.role}</td>
                  <td className="px-6 py-3 text-sm text-right text-foreground">{r.activities}</td>
                  <td className="px-6 py-3 text-sm text-right text-foreground">{r.tasks}</td>
                  <td className="px-6 py-3 text-sm text-right text-foreground">{r.leads}</td>
                </tr>
              ))}
              {reps.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-xs text-muted">No rep data available</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top Objections */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Objections</h3>
          <div className="space-y-3">
            {objections.map((obj, i) => (
              <div key={obj} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-muted">{i + 1}</span>
                <span className="text-sm text-foreground flex-1">{obj}</span>
                <span className="text-xs text-muted">{Math.floor(Math.random() * 8 + 2)} mentions</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Conversion Funnel</h3>
        <div className="flex items-end gap-2 h-40">
          {[
            { label: "Leads", count: stats.totalLeads || 10, pct: 100, color: "bg-blue-500" },
            { label: "Contacted", count: Math.round((stats.totalLeads || 10) * 0.7), pct: 70, color: "bg-indigo-500" },
            { label: "Qualified", count: Math.round((stats.totalLeads || 10) * 0.4), pct: 40, color: "bg-purple-500" },
            { label: "Proposal", count: Math.round((stats.totalDeals || 5) * 0.6), pct: 25, color: "bg-amber-500" },
            { label: "Won", count: stats.wonDeals || 2, pct: 12, color: "bg-success" },
          ].map((step) => (
            <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-foreground">{step.count}</span>
              <div className="w-full rounded-t bg-background relative overflow-hidden" style={{ height: `${Math.max(step.pct, 8)}%` }}>
                <div className={`absolute inset-0 ${step.color} rounded-t`} />
              </div>
              <span className="text-[10px] text-muted">{step.label}</span>
              <span className="text-[10px] text-muted">{step.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Velocity Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Avg Response Time", value: "2.4h", desc: "First contact", trend: "-18%", positive: true },
          { label: "Avg Deal Cycle", value: `${stats.avgCycle || 32}d`, desc: "Lead to close", trend: "-5d", positive: true },
          { label: "Pipeline Velocity", value: formatCurrency((stats.totalPipeline || 0) / Math.max(stats.avgCycle || 32, 1) * 30), desc: "Per month", trend: "+12%", positive: true },
          { label: "Activity Score", value: `${Math.min(Math.round(((stats.totalActivities || 0) / Math.max(stats.totalLeads || 1, 1)) * 10), 100)}/100`, desc: "Engagement index", trend: "+8", positive: true },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-muted mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium ${metric.positive ? "text-success" : "text-danger"}`}>{metric.trend}</span>
              <span className="text-[11px] text-muted">{metric.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
