"use client";

import { useAuth } from "@/lib/auth-context";
import { useApi, apiPut } from "@/lib/hooks/use-api";
import { StatCard } from "@/components/shared/stat-card";
import { AlertsPanel } from "@/components/shared/alerts-panel";
import { GlobalRecommendations } from "@/components/dashboard/GlobalRecommendations";
import Link from "next/link";
import { useCallback } from "react";

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

interface LeadItem {
  id: string;
  name: string;
  email: string;
  status: string;
  temperature: string;
  fitScore: number;
  updatedAt: string;
  lastContactedAt: string | null;
  company: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  owner: { id: string; name: string } | null;
  opportunity: { id: string; title: string } | null;
}

interface ActivityItem {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  creator: { id: string; name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function overdueLabel(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Due today";
  if (days === 1) return "1 day overdue";
  return `${days} days overdue`;
}

function tempOrder(t: string): number {
  if (t === "HOT") return 0;
  if (t === "WARM") return 1;
  return 2;
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

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-border mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <div className="h-2 w-2 rounded-full bg-border" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-3/4 rounded bg-border" />
              <div className="h-3 w-1/2 rounded bg-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SDRWorkspace() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

  // Primary dashboard data (stats, priority leads)
  const { data: dashboard, loading: dashLoading } = useApi<DashboardData>("/api/dashboard");

  // Priority queue: hot/warm leads sorted by temperature then fitScore
  const { data: priorityLeads, loading: leadsLoading } = useApi<LeadItem[]>(
    "/api/leads?status=NEW,CONTACTED,QUALIFIED&sortBy=fitScore&sortOrder=desc&limit=8"
  );

  // Overdue tasks
  const { data: overdueTasks, loading: tasksLoading, refetch: refetchTasks } = useApi<TaskItem[]>(
    "/api/tasks?status=TODO,IN_PROGRESS&sortBy=dueDate&sortOrder=asc&limit=10"
  );

  // Recent activities
  const { data: activities, loading: activitiesLoading } = useApi<ActivityItem[]>(
    "/api/activities?limit=10&sortOrder=desc"
  );

  const s = dashboard?.stats;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Sort priority leads by temperature order, then fitScore
  const sortedLeads = (priorityLeads || [])
    .sort((a, b) => {
      const tDiff = tempOrder(a.temperature) - tempOrder(b.temperature);
      if (tDiff !== 0) return tDiff;
      return (b.fitScore || 0) - (a.fitScore || 0);
    })
    .slice(0, 8);

  // Filter overdue tasks (dueDate < now and not completed)
  const now = new Date();
  const overdue = (overdueTasks || []).filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED"
  );

  const handleCompleteTask = useCallback(async (taskId: string) => {
    await apiPut(`/api/tasks/${taskId}`, { status: "COMPLETED" });
    refetchTasks();
  }, [refetchTasks]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {today}
          {s && s.hotLeads > 0 && (
            <span className="ml-2 font-medium text-primary">
              &middot; You have {s.hotLeads} hot lead{s.hotLeads !== 1 ? "s" : ""} to work today
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
            label="My Active Leads"
            value={s.totalLeads}
            change={`${s.hotLeads} hot`}
            changeType={s.hotLeads > 0 ? "positive" : "neutral"}
          />
          <StatCard
            label="Tasks Due Today"
            value={s.pendingTasks}
            change={`${s.overdueTasks} overdue`}
            changeType={s.overdueTasks > 0 ? "negative" : "positive"}
          />
          <StatCard
            label="Conversions This Week"
            value={s.conversionRate > 0 ? Math.round(s.totalLeads * s.conversionRate / 100) : 0}
            change={`${s.conversionRate}% conversion rate`}
            changeType={s.conversionRate > 0 ? "positive" : "neutral"}
          />
          <StatCard
            label="Response Rate"
            value={s.totalLeads > 0 ? `${Math.round((s.totalActivities / s.totalLeads) * 100)}%` : "0%"}
            change={`${s.totalActivities} activities / ${s.totalLeads} leads`}
            changeType="neutral"
          />
        </div>
      )}

      {/* Priority Queue */}
      {leadsLoading ? (
        <SkeletonList rows={5} />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Priority Queue — What to Do Next</h2>
            <Link href="/leads" className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
              View All Leads
            </Link>
          </div>
          {sortedLeads.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">No priority leads at the moment. Great job staying on top of it!</p>
          ) : (
            <div className="space-y-2">
              {sortedLeads.map((lead) => {
                const needsAttention = daysSince(lead.lastContactedAt || lead.updatedAt) > 3;
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-background/50 transition-colors"
                  >
                    <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          lead.temperature === "HOT" ? "bg-danger" : lead.temperature === "WARM" ? "bg-warning" : "bg-success"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {lead.name}
                          {lead.company && <span className="text-muted"> — {lead.company.name}</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted">{lead.temperature} &middot; {lead.status}</span>
                          <span className="text-xs text-muted">&middot; {timeAgo(lead.lastContactedAt || lead.updatedAt)}</span>
                          {needsAttention && (
                            <span className="inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                              Needs Attention
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Link
                        href={`/leads/${lead.id}?action=call`}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors"
                      >
                        Call
                      </Link>
                      <Link
                        href={`/leads/${lead.id}?action=email`}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors"
                      >
                        Email
                      </Link>
                      <Link
                        href={`/leads/${lead.id}?action=followup`}
                        className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                      >
                        Follow Up
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Overdue Tasks */}
      {tasksLoading ? (
        <SkeletonList rows={3} />
      ) : overdue.length > 0 ? (
        <div className="rounded-xl border border-danger/30 bg-surface p-6">
          <h2 className="text-base font-semibold text-danger mb-4">
            Overdue Tasks ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger/5 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-danger mt-0.5">
                    {task.dueDate ? overdueLabel(task.dueDate) : "No due date"}
                    {task.opportunity && <span className="text-muted"> &middot; {task.opportunity.title}</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  className="shrink-0 ml-3 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
                >
                  Complete
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Action Center - Rule Engine Recommendations */}
      <GlobalRecommendations />

      {/* Alerts */}
      <AlertsPanel maxItems={4} filterEntity="lead" title="Lead Alerts" />

      {/* Recent Activity Feed */}
      {activitiesLoading ? (
        <SkeletonList rows={5} />
      ) : (activities || []).length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-1">
            {(activities || []).slice(0, 10).map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-background/50 transition-colors"
              >
                <div
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    act.type === "CALL" ? "bg-primary" : act.type === "EMAIL" ? "bg-success" : "bg-muted"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{act.summary}</p>
                  <p className="text-xs text-muted mt-0.5">{act.type} &middot; {timeAgo(act.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-3">
        <Link
          href="/leads/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          + New Lead
        </Link>
        <Link
          href="/activities/new"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background transition-colors"
        >
          Log Activity
        </Link>
        <Link
          href="/leads"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background transition-colors"
        >
          View All Leads
        </Link>
      </div>
    </div>
  );
}
