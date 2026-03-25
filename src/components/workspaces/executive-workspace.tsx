"use client";

import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/hooks/use-api";
import { StatCard } from "@/components/shared/stat-card";
import { AlertsPanel } from "@/components/shared/alerts-panel";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

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

interface OpportunityItem {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  updatedAt: string;
  account: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
}

interface IntegrationItem {
  id: string;
  name: string;
  status: string;
  lastSync: string;
  health: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

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

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-border mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-border" />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExecutiveWorkspace() {
  useAuth(); // ensure authenticated

  const { data: dashboard, loading: dashLoading } = useApi<DashboardData>("/api/dashboard");

  // Top deals by value
  const { data: topDeals, loading: dealsLoading } = useApi<OpportunityItem[]>(
    "/api/opportunities?limit=5&sortBy=value&sortOrder=desc"
  );

  // Integrations health
  const { data: integrations, loading: integrationsLoading } = useApi<IntegrationItem[]>(
    "/api/integrations?limit=10"
  );

  // Engine-driven alerts for key risks and deal health
  const { data: alertsData, loading: alertsLoading } = useApi<{
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      description: string;
      reasoning: string;
      entityType: string;
      entityId: string;
      entityName: string;
      actionUrl: string;
    }>;
    summary: { critical: number; warning: number; info: number; total: number };
  }>("/api/alerts/v2");

  const s = dashboard?.stats;
  const stages = dashboard?.stages || [];
  const channels = dashboard?.channels || [];

  // Key risks from AlertEngine (replaces dealsNeedingAttention)
  const keyRisks = (alertsData?.alerts || [])
    .filter((a) => a.severity === "critical" || a.severity === "warning")
    .slice(0, 5);

  // Alert-based deal health (replaces inline probability/staleness thresholds)
  const alertedDealIds = new Set(
    (alertsData?.alerts || [])
      .filter((a) => a.entityType === "opportunity")
      .map((a) => a.entityId)
  );
  const criticalDealIds = new Set(
    (alertsData?.alerts || [])
      .filter((a) => a.entityType === "opportunity" && a.severity === "critical")
      .map((a) => a.entityId)
  );

  const dealHealth = (opp: OpportunityItem): { label: string; color: string } => {
    if (criticalDealIds.has(opp.id)) return { label: "At Risk", color: "text-danger bg-danger/10" };
    if (alertedDealIds.has(opp.id)) return { label: "Fair", color: "text-warning bg-warning/10" };
    return { label: "Healthy", color: "text-success bg-success/10" };
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Intelligence</h1>
        <p className="mt-1 text-sm text-muted">
          Strategic overview of revenue operations
          {s && (
            <span className="ml-2 font-medium text-primary">
              &middot; {formatCurrency(s.wonValue, "USD")} closed this period
            </span>
          )}
        </p>
      </div>

      {/* Quick Stats Row 1 */}
      {dashLoading || !s ? (
        <SkeletonStats />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Total Pipeline"
              value={formatCurrency(s.totalPipeline, "USD")}
              change={`${s.activeDeals} active deals`}
              changeType="neutral"
            />
            <StatCard
              label="Forecast (Weighted)"
              value={formatCurrency(s.forecastCommit, "USD")}
              change={"\u226570% probability"}
              changeType="positive"
            />
            <StatCard
              label="Pipeline Coverage"
              value={`${s.coverageRatio}x`}
              change="Pipeline / Forecast"
              changeType={s.coverageRatio >= 3 ? "positive" : "negative"}
            />
            <StatCard
              label="Win Rate"
              value={`${s.winRate}%`}
              change="Org-wide closed deals"
              changeType={s.winRate >= 25 ? "positive" : "negative"}
            />
          </div>

          {/* Quick Stats Row 2 */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Won Revenue"
              value={formatCurrency(s.wonValue, "USD")}
              change="Closed won"
              changeType="positive"
            />
            <StatCard
              label="Best Case"
              value={formatCurrency(s.bestCase, "USD")}
              change={"\u226540% probability"}
              changeType="neutral"
            />
            <StatCard
              label="Avg. Deal Size"
              value={formatCurrency(s.avgDealSize, "USD")}
              change="Active pipeline"
              changeType="neutral"
            />
            <StatCard
              label="At Risk"
              value={s.atRiskDeals}
              change={s.atRiskDeals > 0 ? "Below 40% probability" : "All healthy"}
              changeType={s.atRiskDeals > 0 ? "negative" : "positive"}
            />
          </div>
        </>
      )}

      {/* Pipeline by Stage — horizontal bar chart */}
      {!dashLoading && s && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Pipeline by Stage</h2>
          <div className="space-y-4">
            {stages.map((st) => {
              const pct = s.totalPipeline > 0 ? Math.round((st.value / s.totalPipeline) * 100) : 0;
              return (
                <div key={st.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <Link href="/pipeline" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                      {stageLabel(st.stage)}
                    </Link>
                    <span className="text-sm text-muted">{formatCurrency(st.value, "USD")} &middot; {st.count} deals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 rounded-full bg-background">
                      <div
                        className="h-3 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Top Deals */}
        {dealsLoading ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Top Deals</h2>
              <Link href="/opportunities" className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                View All
              </Link>
            </div>
            {(topDeals || []).length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No open deals</p>
            ) : (
              <div className="space-y-2">
                {(topDeals || []).slice(0, 5).map((deal) => {
                  const health = dealHealth(deal);
                  return (
                    <Link
                      key={deal.id}
                      href={`/opportunities/${deal.id}`}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-background/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {stageLabel(deal.stage)} &middot; {deal.owner?.name || "Unassigned"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.color}`}>
                          {health.label}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value, "USD")}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Key Risks (engine-driven) */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Key Risks</h2>
          {alertsLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-border" />)}
            </div>
          ) : keyRisks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-success">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-sm text-muted">No critical risks detected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keyRisks.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.actionUrl}
                  className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 px-4 py-2.5 hover:bg-danger/10 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          alert.severity === "critical"
                            ? "text-danger bg-danger/10"
                            : "text-warning bg-warning/10"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{alert.reasoning}</p>
                  </div>
                  {alert.entityName && (
                    <span className="text-xs text-muted shrink-0 ml-3">{alert.entityName}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      <AlertsPanel maxItems={5} compact title="Key Alerts" />

      <div className="grid grid-cols-2 gap-4">
        {/* Lead Channels */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Lead Channels</h2>
          <div className="space-y-3">
            {channels.map((ch) => (
              <div key={ch.name} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground">{ch.name}</span>
                    <span className="text-xs text-muted">{ch.leads} leads &middot; {ch.conversion}% conv.</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-background">
                    <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${Math.min(ch.conversion, 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Health */}
        {integrationsLoading ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Integration Health</h2>
              <Link href="/settings/integrations" className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                Manage
              </Link>
            </div>
            {(integrations || []).length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No integrations configured</p>
            ) : (
              <div className="space-y-2">
                {(integrations || []).slice(0, 5).map((intg) => (
                  <div
                    key={intg.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          intg.status === "active" || intg.status === "ACTIVE"
                            ? "bg-success"
                            : intg.status === "error" || intg.status === "ERROR"
                            ? "bg-danger"
                            : "bg-warning"
                        }`}
                      />
                      <span className="text-sm font-medium text-foreground">{intg.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {intg.lastSync && (
                        <span className="text-xs text-muted">
                          Synced {daysSince(intg.lastSync) === 0 ? "today" : `${daysSince(intg.lastSync)}d ago`}
                        </span>
                      )}
                      <span
                        className={`text-xs font-medium ${
                          intg.health >= 90 ? "text-success" : intg.health >= 70 ? "text-warning" : "text-danger"
                        }`}
                      >
                        {intg.health}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Metrics */}
      {!dashLoading && s && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Quick Metrics</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center rounded-lg border border-border p-4">
              <p className="text-2xl font-bold text-foreground">{s.totalLeads}</p>
              <p className="text-xs text-muted mt-1">Total Leads</p>
            </div>
            <div className="text-center rounded-lg border border-border p-4">
              <p className="text-2xl font-bold text-foreground">{s.totalActivities}</p>
              <p className="text-xs text-muted mt-1">Total Activities</p>
            </div>
            <div className="text-center rounded-lg border border-border p-4">
              <p className="text-2xl font-bold text-foreground">{s.pendingTasks}</p>
              <p className="text-xs text-muted mt-1">Pending Tasks</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
