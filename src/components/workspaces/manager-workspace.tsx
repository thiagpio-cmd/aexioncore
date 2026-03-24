"use client";

import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/hooks/use-api";
import { StatCard } from "@/components/shared/stat-card";
import { AlertsPanel } from "@/components/shared/alerts-panel";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  stats: {
    totalPipeline: number;
    wonValue: number;
    winRate: number;
    avgDealSize: number;
    hotLeads: number;
    todayLeads: number;
    overdueTasks: number;
    pendingTasks: number;
    conversionRate: number;
    activeDeals: number;
    atRiskDeals: number;
    proposalsSent: number;
    closingThisMonth: number;
    closingValue: number;
    forecastCommit: number;
    bestCase: number;
    coverageRatio: number;
    totalLeads: number;
    totalActivities: number;
  };
  stages: { stage: string; count: number; value: number }[];
  reps: { id: string; name: string; role: string; activities: number; tasks: number; overdueTasks: number; leads: number }[];
  channels: { name: string; leads: number; conversion: number }[];
  priorityLeads: { id: string; name: string; company: string; status: string; temperature: string; owner: string }[];
  dealsNeedingAttention: { id: string; title: string; account: string; value: number; probability: number; stage: string }[];
  upcomingMeetings: { id: string; title: string; startTime: string; type: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}

type SortKey = "name" | "leads" | "activities" | "overdueTasks" | "tasks";

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonStats() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5 animate-pulse">
          <div className="h-3 w-20 rounded bg-border mb-2" />
          <div className="h-7 w-16 rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-border mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-border" />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManagerWorkspace() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Manager";

  const { data: dashboard, loading } = useApi<DashboardData>("/api/dashboard");

  const [sortKey, setSortKey] = useState<SortKey>("overdueTasks");
  const [sortAsc, setSortAsc] = useState(false);

  const s = dashboard?.stats;
  const reps = dashboard?.reps || [];
  const stages = dashboard?.stages || [];

  // Sort reps
  const sortedReps = [...reps].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  // Conversion funnel
  const totalLeads = s?.totalLeads || 0;
  const qualifiedLeads = Math.round(totalLeads * (s?.conversionRate || 0) / 100);
  const proposals = stages.find((st) => st.stage === "PROPOSAL")?.count || 0;
  const won = s ? Math.round(s.activeDeals * s.winRate / 100) : 0;
  const funnel = [
    { label: "Leads", count: totalLeads },
    { label: "Qualified", count: qualifiedLeads },
    { label: "Proposals", count: proposals },
    { label: "Won", count: won },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{firstName}&apos;s Team Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Team performance and pipeline health
          {reps.length > 0 && <span className="ml-2 font-medium text-primary">&middot; {reps.length} team members</span>}
        </p>
      </div>

      {/* Quick Stats */}
      {loading || !s ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Team Pipeline"
            value={formatCurrency(s.totalPipeline, "USD")}
            change={`${s.activeDeals} active deals`}
            changeType="neutral"
          />
          <StatCard
            label="Team Win Rate"
            value={`${s.winRate}%`}
            change={`${stages.find((st) => st.stage === "NEGOTIATION")?.count || 0} in negotiation`}
            changeType={s.winRate >= 25 ? "positive" : "negative"}
          />
          <StatCard
            label="Open Tasks"
            value={s.pendingTasks}
            change={`${s.overdueTasks} overdue across team`}
            changeType={s.overdueTasks > 0 ? "negative" : "positive"}
          />
          <StatCard
            label="At-Risk Deals"
            value={s.atRiskDeals}
            change={s.atRiskDeals > 0 ? "Below 40% probability" : "All healthy"}
            changeType={s.atRiskDeals > 0 ? "negative" : "positive"}
          />
        </div>
      )}

      {/* Team Performance Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Team Performance</h2>
          {sortedReps.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No team members found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {(
                      [
                        { key: "name" as SortKey, label: "Name" },
                        { key: "leads" as SortKey, label: "Active Leads" },
                        { key: "activities" as SortKey, label: "Activities" },
                        { key: "tasks" as SortKey, label: "Total Tasks" },
                        { key: "overdueTasks" as SortKey, label: "Overdue" },
                      ] as const
                    ).map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-3 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors select-none"
                      >
                        {col.label}
                        {sortKey === col.key && (
                          <span className="ml-1">{sortAsc ? "\u2191" : "\u2193"}</span>
                        )}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReps.map((rep) => {
                    const hasIssues = rep.overdueTasks > 3;
                    const hasWarning = rep.overdueTasks > 0 && rep.overdueTasks <= 3;
                    return (
                      <tr
                        key={rep.id}
                        className={`border-b border-border last:border-0 transition-colors ${
                          hasIssues ? "bg-danger/5" : hasWarning ? "bg-warning/5" : "hover:bg-background/50"
                        }`}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                hasIssues ? "bg-danger" : hasWarning ? "bg-warning" : "bg-success"
                              }`}
                            />
                            <span className="text-sm font-medium text-foreground">{rep.name}</span>
                            <span className="text-xs text-muted">({rep.role})</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-foreground">{rep.leads}</td>
                        <td className="px-3 py-3 text-sm text-foreground">{rep.activities}</td>
                        <td className="px-3 py-3 text-sm text-foreground">{rep.tasks}</td>
                        <td className="px-3 py-3">
                          {rep.overdueTasks > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                              {rep.overdueTasks}
                            </span>
                          ) : (
                            <span className="text-xs text-success font-medium">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {hasIssues ? (
                            <span className="text-xs font-medium text-danger">Needs Help</span>
                          ) : hasWarning ? (
                            <span className="text-xs font-medium text-warning">Watch</span>
                          ) : (
                            <span className="text-xs font-medium text-success">On Track</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Risk Panel */}
      {(dashboard?.dealsNeedingAttention || []).length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-surface p-6">
          <h2 className="text-base font-semibold text-danger mb-4">
            Risk Panel — Deals Across Team ({dashboard?.dealsNeedingAttention.length})
          </h2>
          <div className="space-y-2">
            {(dashboard?.dealsNeedingAttention || []).map((deal) => (
              <Link
                key={deal.id}
                href={`/opportunities/${deal.id}`}
                className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 hover:bg-danger/10 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                  <p className="text-xs text-danger mt-0.5">
                    {deal.account} &middot; {stageLabel(deal.stage)} &middot; {deal.probability}% probability
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground shrink-0 ml-3">
                  {formatCurrency(deal.value, "USD")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Team Alerts */}
      <AlertsPanel maxItems={6} title="Team Alerts" />

      {/* Conversion Funnel + Pipeline by Stage */}
      <div className="grid grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnel.map((step, idx) => {
              const maxCount = funnel[0].count || 1;
              const pct = Math.round((step.count / maxCount) * 100);
              const convRate = idx > 0 && funnel[idx - 1].count > 0
                ? Math.round((step.count / funnel[idx - 1].count) * 100)
                : 100;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground font-semibold">{step.count}</span>
                      {idx > 0 && (
                        <span className="text-xs text-muted">({convRate}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-background">
                    <div
                      className="h-3 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline by Stage */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Pipeline by Stage</h2>
          <div className="space-y-3">
            {stages.map((st) => {
              const pct = s && s.totalPipeline > 0 ? Math.round((st.value / s.totalPipeline) * 100) : 0;
              return (
                <div key={st.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground">{stageLabel(st.stage)}</span>
                    <span className="text-xs text-muted">{st.count} deals &middot; {formatCurrency(st.value, "USD")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-background">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
