"use client";

import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/hooks/use-api";
import { StatCard } from "@/components/shared/stat-card";
import { AlertsPanel } from "@/components/shared/alerts-panel";
import { formatCurrency } from "@/lib/utils";
import { GlobalRecommendations } from "@/components/dashboard/GlobalRecommendations";
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
  stageChangedAt?: string;
  updatedAt: string;
  expectedCloseDate: string | null;
  account: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
}

interface MeetingItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  type: string;
  location: string | null;
  opportunity?: { id: string; title: string } | null;
  contact?: { id: string; name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

const PIPELINE_STAGES = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"] as const;

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
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
      <div className="h-4 w-32 rounded bg-border mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-border bg-background/50" />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CloserWorkspace() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

  const { data: dashboard, loading: dashLoading } = useApi<DashboardData>("/api/dashboard");

  // Opportunities for pipeline view
  const { data: opportunities, loading: oppsLoading } = useApi<OpportunityItem[]>(
    "/api/opportunities?limit=50&sortBy=value&sortOrder=desc"
  );

  // Upcoming meetings
  const { data: meetings, loading: meetingsLoading } = useApi<MeetingItem[]>(
    "/api/meetings?limit=5&sortBy=startTime&sortOrder=asc"
  );

  // Engine-driven alerts for at-risk deals
  const { data: alertsData } = useApi<{
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
      actionLabel: string;
      actionUrl: string;
      triggerValue: number;
      threshold: number;
    }>;
    summary: { critical: number; warning: number; info: number; total: number };
  }>("/api/alerts/v2");

  // Engine-driven recommendations for next best actions
  const { data: recsData } = useApi<{
    recommendations: Array<{
      id: string;
      type: string;
      priority: string;
      title: string;
      description: string;
      reasoning: string;
      confidence: number;
      impact: string;
      effort: string;
      actionLabel: string;
      actionUrl: string;
      entityName: string;
    }>;
  }>("/api/recommendations?limit=5");

  const s = dashboard?.stats;
  const stages = dashboard?.stages || [];

  // Group opportunities by stage for mini-kanban
  const oppsByStage: Record<string, OpportunityItem[]> = {};
  PIPELINE_STAGES.forEach((st) => {
    oppsByStage[st] = [];
  });
  (opportunities || []).forEach((opp) => {
    if (oppsByStage[opp.stage]) {
      oppsByStage[opp.stage].push(opp);
    }
  });

  // At-risk deals from AlertEngine (replaces inline computation)
  const atRiskAlerts = (alertsData?.alerts || []).filter(
    (a) =>
      a.entityType === "opportunity" &&
      (a.type === "STUCK_DEAL" || a.type === "AT_RISK_DEAL" || a.type === "NO_NEXT_STEP" || a.type === "DEAL_AGING")
  );

  // Next best actions from RecommendationEngine (replaces inline rules)
  const nextActions = (recsData?.recommendations || []).slice(0, 5);

  // Upcoming meetings filtered to future
  const now = new Date();
  const upcomingMeetings = (meetings || []).filter((m) => new Date(m.startTime) >= now).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Greeting + Deal Snapshot */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Deal Command Center
          {s && (
            <span className="ml-2 font-medium text-primary">
              &middot; Pipeline: {formatCurrency(s.totalPipeline, "BRL")}
            </span>
          )}
        </p>
      </div>

      {/* Quick Stats */}
      {dashLoading || !s ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Pipeline Value"
            value={formatCurrency(s.totalPipeline, "BRL")}
            change={`${s.activeDeals} active deals`}
            changeType="neutral"
          />
          <StatCard
            label="Closing This Month"
            value={s.closingThisMonth}
            change={formatCurrency(s.closingValue, "BRL")}
            changeType="positive"
          />
          <StatCard
            label="Win Rate"
            value={`${s.winRate}%`}
            change="Closed deals this quarter"
            changeType={s.winRate >= 25 ? "positive" : "negative"}
          />
          <StatCard
            label="Avg Deal Size"
            value={formatCurrency(s.avgDealSize, "BRL")}
            change="Active pipeline"
            changeType="neutral"
          />
        </div>
      )}

      {/* Mini Kanban Pipeline */}
      {oppsLoading ? (
        <SkeletonCard />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">My Pipeline</h2>
            <Link href="/pipeline" className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
              Full Pipeline View
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const stageData = stages.find((st) => st.stage === stage);
              const stageOpps = oppsByStage[stage] || [];
              return (
                <div key={stage} className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">{stageLabel(stage)}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-bold text-foreground">{stageData?.count || 0}</span>
                      <span className="text-xs text-muted">{formatCurrency(stageData?.value || 0, "BRL")}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stageOpps.slice(0, 3).map((opp) => {
                      const daysInStage = daysSince(opp.stageChangedAt || opp.updatedAt);
                      const isStuck = daysInStage > 14;
                      return (
                        <Link
                          key={opp.id}
                          href={`/opportunities/${opp.id}`}
                          className="block rounded-md border border-border bg-surface p-2.5 hover:border-primary/30 transition-colors"
                        >
                          <p className="text-xs font-medium text-foreground truncate">{opp.title}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted">{formatCurrency(opp.value, "BRL")}</span>
                            <span className="text-[10px] text-muted">{daysInStage}d</span>
                          </div>
                          {isStuck && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                              Stuck
                            </span>
                          )}
                        </Link>
                      );
                    })}
                    {stageOpps.length === 0 && (
                      <p className="text-xs text-muted text-center py-2">No deals</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* At-Risk Deals (engine-driven) */}
      {atRiskAlerts.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-surface p-6">
          <h2 className="text-base font-semibold text-danger mb-4">
            At-Risk Deals ({atRiskAlerts.length})
          </h2>
          <div className="space-y-2">
            {atRiskAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 px-4 py-3"
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
                  <p className="text-xs text-danger mt-0.5">
                    {alert.reasoning}
                    {alert.entityName && <span className="text-muted"> &middot; {alert.entityName}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Link
                    href={alert.actionUrl}
                    className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                  >
                    {alert.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Best Actions (engine-driven) */}
      {nextActions.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Next Best Actions</h2>
          <div className="space-y-2">
            {nextActions.map((rec) => (
              <Link
                key={rec.id}
                href={rec.actionUrl}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-background/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{rec.title}</p>
                  <p className="text-xs text-muted mt-0.5">{rec.reasoning}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      rec.confidence >= 80
                        ? "text-success bg-success/10"
                        : rec.confidence >= 50
                        ? "text-warning bg-warning/10"
                        : "text-muted bg-border"
                    }`}
                  >
                    {rec.confidence}%
                  </span>
                  <span className="text-xs font-medium text-primary">{rec.actionLabel}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Upcoming Meetings */}
        {meetingsLoading ? (
          <SkeletonCard />
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Upcoming Meetings</h2>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No upcoming meetings</p>
            ) : (
              <div className="space-y-2">
                {upcomingMeetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/meetings/${meeting.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-background/50 transition-colors"
                  >
                    <div className="shrink-0 text-center">
                      <p className="text-sm font-semibold text-primary">
                        {new Date(meeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-[10px] text-muted">
                        {new Date(meeting.startTime).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{meeting.title}</p>
                      <p className="text-xs text-muted truncate">
                        {meeting.type}
                        {meeting.location && ` &middot; ${meeting.location}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deals Needing Attention from dashboard */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Deals Needing Attention</h2>
          {dashLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-border" />
              ))}
            </div>
          ) : (dashboard?.dealsNeedingAttention || []).length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">All deals are healthy</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.dealsNeedingAttention || []).map((deal) => (
                <Link
                  key={deal.id}
                  href={`/opportunities/${deal.id}`}
                  className="block rounded-lg border border-border p-3 hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value, "BRL")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted">{deal.account} &middot; {stageLabel(deal.stage)}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-background">
                        <div
                          className={`h-1.5 rounded-full ${deal.probability < 30 ? "bg-danger" : deal.probability < 60 ? "bg-warning" : "bg-success"}`}
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{deal.probability}%</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deal Alerts */}
      <AlertsPanel maxItems={4} filterEntity="opportunity" title="Deal Alerts" />

      {/* Global Recommendations / Action Center */}
      <GlobalRecommendations />

      {/* Stage Progression */}
      {!dashLoading && s && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Stage Progression</h2>
          <div className="space-y-3">
            {stages.map((st, idx) => {
              const colors = ["bg-primary/40", "bg-primary/55", "bg-primary/70", "bg-primary/85", "bg-primary", "bg-success"];
              const barColor = colors[Math.min(idx, colors.length - 1)];
              const pct = s.totalPipeline > 0 ? Math.round((st.value / s.totalPipeline) * 100) : 0;
              return (
                <div key={st.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-28 truncate">{stageLabel(st.stage)}</span>
                  <div className="flex-1 h-2 rounded-full bg-background">
                    <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-20 text-right">{st.count} deals &middot; {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
