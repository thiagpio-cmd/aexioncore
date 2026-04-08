"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/hooks/use-api";
import { WorkspaceType } from "@/types";
import { SDRWorkspace } from "@/components/workspaces/sdr-workspace";
import { CloserWorkspace } from "@/components/workspaces/closer-workspace";
import { ManagerWorkspace } from "@/components/workspaces/manager-workspace";
import { ExecutiveWorkspace } from "@/components/workspaces/executive-workspace";
import { SetupWizard, isOnboardingComplete } from "@/components/onboarding/setup-wizard";
import { SetupProgressBanner } from "@/components/onboarding/progress-banner";
import { MoneyAtRiskWidget } from "@/components/MoneyAtRiskWidget";
import { AIInsightBanner } from "@/components/ai/ai-insight-banner";
import { DebriefModal } from "@/components/DebriefModal";
import { TodayView, TodayViewData } from "@/components/today-view";
import { MarketIntelWidget } from "@/components/market-intel-widget";
import { BentoGrid } from "@/components/design-system/BentoGrid";
import { GlassCard } from "@/components/design-system/GlassCard";
import { MetricValue } from "@/components/design-system/MetricValue";
import { SectionLabel } from "@/components/design-system/SectionLabel";
import { StatusDot } from "@/components/design-system/StatusDot";

interface DashboardStats {
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
}

interface DealAttention {
  id: string;
  title: string;
  account: string;
  value: number;
  probability: number;
  stage: string;
}

interface UpcomingMeeting {
  id: string;
  title: string;
  startTime: string;
  type: string;
}

interface DashboardData {
  stats: DashboardStats;
  stages: Array<{ stage: string; count: number; value: number }>;
  dealsNeedingAttention: DealAttention[];
  upcomingMeetings: UpcomingMeeting[];
  priorityLeads: Array<{ id: string; name: string; company: string; status: string; temperature: string }>;
  todayView?: TodayViewData;
}

/** Convert DB stage names like LOI_SUBMITTED → "Loi Submitted" */
function stageLabel(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUSD(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function DashboardBentoOverview({ workspace, data }: { workspace: WorkspaceType; data: DashboardData }) {
  const isExecutive = workspace === WorkspaceType.EXECUTIVE;
  const isManager = workspace === WorkspaceType.MANAGER || isExecutive;
  const stats = data.stats;

  return (
    <BentoGrid columns={4} gap="10px">
      {/* Row 1: Pipeline Value (span 2) */}
      <GlassCard accent span={2}>
        <SectionLabel>Pipeline Value</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <MetricValue
            value={formatUSD(stats.totalPipeline)}
            label="Total active"
            size="hero"
            prefix=""
            subtitle={stats.activeDeals > 0 ? `${stats.activeDeals} active deals` : undefined}
            subtitleColor="muted"
          />
        </div>
      </GlassCard>

      {/* Row 1: Forecast (span 1) */}
      <GlassCard span={1}>
        <SectionLabel>Forecast</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <MetricValue
            value={formatUSD(stats.forecastCommit)}
            label="Monthly commit"
            size="large"
            prefix=""
          />
        </div>
        <div style={{ marginTop: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <StatusDot status={stats.coverageRatio >= 3 ? "success" : stats.coverageRatio >= 2 ? "warning" : "danger"} size="sm" />
          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
            {stats.coverageRatio}x coverage
          </span>
        </div>
      </GlassCard>

      {/* Row 1-2: Today/Agenda (span 1, rowspan 2) */}
      <GlassCard span={1} rowSpan={2}>
        <SectionLabel>Schedule</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {data.upcomingMeetings.length > 0 ? (
            data.upcomingMeetings.slice(0, 4).map((meeting) => (
              <div key={meeting.id} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
                <StatusDot status="accent" size="sm" />
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                    {meeting.title}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>
                    {formatTime(meeting.startTime)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
              No meetings scheduled
            </p>
          )}
          {stats.overdueTasks > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
              <StatusDot status="danger" size="sm" />
              <div>
                <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  {stats.overdueTasks} overdue task{stats.overdueTasks > 1 ? "s" : ""}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: 0 }}>Action required</p>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Row 2: Risk Alert (span 1) */}
      <GlassCard danger={stats.atRiskDeals > 0} span={1}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
          <StatusDot status={stats.atRiskDeals > 0 ? "danger" : "success"} size="md" pulse={stats.atRiskDeals > 0} />
          <SectionLabel>{stats.atRiskDeals > 0 ? "Risk Alert" : "Healthy Pipeline"}</SectionLabel>
        </div>
        <MetricValue
          value={String(stats.atRiskDeals)}
          label="Deals at risk"
          size="large"
          subtitle={stats.atRiskDeals > 0 ? `Prob. < 40%` : "No critical deals"}
          subtitleColor={stats.atRiskDeals > 0 ? "danger" : "success"}
        />
      </GlassCard>

      {/* Row 2: Priority Deal (span 2) */}
      <GlassCard accent={data.dealsNeedingAttention.length > 0} span={2}>
        <SectionLabel>Priority Deal</SectionLabel>
        {data.dealsNeedingAttention.length > 0 ? (
          <>
            <div style={{ marginTop: "var(--space-md)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  {data.dealsNeedingAttention[0].title}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "var(--space-xs) 0 0" }}>
                  {data.dealsNeedingAttention[0].account} — {stageLabel(data.dealsNeedingAttention[0].stage)}
                </p>
              </div>
              <MetricValue value={formatUSD(data.dealsNeedingAttention[0].value)} label="Value" size="small" />
            </div>
            <div style={{ marginTop: "var(--space-md)", display: "flex", gap: "var(--space-lg)" }}>
              <StatusDot
                status={data.dealsNeedingAttention[0].probability >= 50 ? "warning" : "danger"}
                size="sm"
                label={`${data.dealsNeedingAttention[0].probability}% probability`}
              />
            </div>
          </>
        ) : (
          <p style={{ marginTop: "var(--space-md)", fontSize: "13px", color: "var(--text-muted)" }}>
            No deals requiring immediate attention
          </p>
        )}
      </GlassCard>

      {/* Row 3: Top Deals (span 2) */}
      <GlassCard span={2}>
        <SectionLabel>Deals Needing Attention</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {data.dealsNeedingAttention.length > 0 ? (
            data.dealsNeedingAttention.slice(0, 3).map((deal) => (
              <div
                key={deal.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-sm) 0",
                  borderBottom: "0.5px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <StatusDot
                    status={deal.probability >= 50 ? "warning" : "danger"}
                    size="sm"
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{deal.title}</span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  {formatUSD(deal.value)}
                </span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "var(--space-sm) 0" }}>
              All deals are healthy
            </p>
          )}
        </div>
      </GlassCard>

      {/* Row 3: Insights (span 1) */}
      <GlassCard span={1}>
        <SectionLabel>Insights</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div>
            <MetricValue
              value={`${stats.conversionRate}%`}
              label="Conversion rate"
              size="small"
              subtitle={`${stats.totalLeads} leads total`}
              subtitleColor="muted"
            />
          </div>
          {isManager && (
            <div>
              <MetricValue
                value={`${stats.winRate}%`}
                label="Win Rate"
                size="small"
                subtitle={stats.winRate >= 50 ? "Above target" : "Below target"}
                subtitleColor={stats.winRate >= 50 ? "success" : "danger"}
              />
            </div>
          )}
        </div>
      </GlassCard>

      {/* Row 3: Closing This Month (span 1) */}
      <GlassCard success={stats.closingThisMonth > 0} span={1}>
        <SectionLabel>Closing This Month</SectionLabel>
        <div style={{ marginTop: "var(--space-md)" }}>
          <MetricValue
            value={String(stats.closingThisMonth)}
            label="Expected deals"
            size="large"
            subtitle={formatUSD(stats.closingValue) + " total"}
            subtitleColor={stats.closingThisMonth > 0 ? "success" : "muted"}
          />
        </div>
      </GlassCard>
    </BentoGrid>
  );
}

function DashboardSkeleton() {
  return (
    <BentoGrid columns={4} gap="10px">
      {[2, 1, 1, 1, 2, 2, 1, 1].map((span, i) => (
        <GlassCard key={i} span={span as 1 | 2 | 3 | 4}>
          <div style={{ height: i === 3 ? "180px" : "100px" }} className="animate-pulse rounded bg-[var(--border-subtle)]" />
        </GlassCard>
      ))}
    </BentoGrid>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <GlassCard>
      <div style={{ textAlign: "center", padding: "var(--space-xl)" }}>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "0 0 var(--space-md)" }}>
          Error loading dashboard data
        </p>
        <button
          onClick={onRetry}
          style={{
            padding: "var(--space-sm) var(--space-lg)",
            borderRadius: "var(--radius-sm)",
            border: "0.5px solid var(--accent-border)",
            background: "var(--accent-muted)",
            color: "var(--accent-text)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </GlassCard>
  );
}

type HomeView = "today" | "overview";

export default function HomePage() {
  const { workspace, user } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefOppId, setDebriefOppId] = useState("");
  const [activeView, setActiveView] = useState<HomeView>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("aexion_home_view") as HomeView) || "today";
    }
    return "today";
  });

  const { data: dashboardData, loading, error, refetch } = useApi<DashboardData>("/api/dashboard");

  useEffect(() => {
    const done = isOnboardingComplete();
    setOnboardingDone(done);
    if (!done) {
      setShowWizard(true);
    }
  }, []);

  function handleViewChange(view: HomeView) {
    setActiveView(view);
    localStorage.setItem("aexion_home_view", view);
  }

  function handleWizardComplete() {
    setShowWizard(false);
    setOnboardingDone(true);
  }

  function handleResumeSetup() {
    setShowWizard(true);
  }

  // Role-specific workspace components below the bento overview
  const workspaceContent = (() => {
    switch (workspace) {
      case WorkspaceType.SDR:
        return <SDRWorkspace />;
      case WorkspaceType.CLOSER:
        return <CloserWorkspace />;
      case WorkspaceType.MANAGER:
        return <ManagerWorkspace />;
      case WorkspaceType.EXECUTIVE:
        return <ExecutiveWorkspace />;
      default:
        return <SDRWorkspace />;
    }
  })();

  const viewTabs: { key: HomeView; label: string; icon: string }[] = [
    { key: "today", label: "Today", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { key: "overview", label: "Overview", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  ];

  return (
    <>
      {showWizard && <SetupWizard onComplete={handleWizardComplete} />}
      {!onboardingDone && !showWizard && (
        <SetupProgressBanner onResumeSetup={handleResumeSetup} />
      )}

      {/* ─── View Toggle ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
        <div
          style={{
            display: "inline-flex",
            gap: "2px",
            padding: "3px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-card)",
            border: "0.5px solid var(--border-subtle)",
          }}
        >
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleViewChange(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                padding: "6px 14px",
                borderRadius: "calc(var(--radius-sm) - 2px)",
                border: "none",
                background: activeView === tab.key ? "var(--bg-card-elevated)" : "transparent",
                color: activeView === tab.key ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: "13px",
                fontWeight: activeView === tab.key ? 600 : 400,
                cursor: "pointer",
                transition: "all var(--transition-default)",
                boxShadow: activeView === tab.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Debrief button (always visible) */}
        <button
          onClick={() => {
            setDebriefOppId("");
            setShowDebrief(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "var(--space-sm) var(--space-lg)",
            borderRadius: "var(--radius-sm)",
            border: "0.5px solid var(--accent-border)",
            background: "var(--accent-muted)",
            color: "var(--accent-text)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "border-color var(--transition-default)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          New Debrief
        </button>
      </div>

      {/* ─── AI Strategic Briefing ─────────────────────────────── */}
      <AIInsightBanner
        prompt="Give me today's executive briefing: top priority deals, overdue tasks, and any at-risk properties in my pipeline"
        className="mb-4"
      />

      {/* ─── Market Intelligence ─────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <BentoGrid columns={4} gap="10px">
          <MarketIntelWidget />
        </BentoGrid>
      </div>

      {/* ─── Today View ───────────────────────────────────────── */}
      {activeView === "today" && (
        <>
          {loading && <DashboardSkeleton />}
          {error && !loading && <DashboardError onRetry={refetch} />}
          {dashboardData && !loading && dashboardData.todayView && (
            <TodayView
              data={dashboardData.todayView}
              stats={{
                totalPipeline: dashboardData.stats.totalPipeline,
                overdueTasks: dashboardData.stats.overdueTasks,
                hotLeads: dashboardData.stats.hotLeads,
                activeDeals: dashboardData.stats.activeDeals,
                atRiskDeals: dashboardData.stats.atRiskDeals,
              }}
              userName={user?.name}
            />
          )}
          {dashboardData && !loading && !dashboardData.todayView && (
            <DashboardBentoOverview workspace={workspace} data={dashboardData} />
          )}
        </>
      )}

      {/* ─── Overview (original bento + workspace) ────────────── */}
      {activeView === "overview" && (
        <>
          {/* Bento Grid Dashboard Overview */}
          <div style={{ marginBottom: "var(--space-2xl)" }}>
            {loading && <DashboardSkeleton />}
            {error && !loading && <DashboardError onRetry={refetch} />}
            {dashboardData && !loading && (
              <DashboardBentoOverview workspace={workspace} data={dashboardData} />
            )}
          </div>

          {/* Money at Risk */}
          <div style={{ marginBottom: "var(--space-xl)" }}>
            <MoneyAtRiskWidget />
          </div>

          {/* Role-specific workspace */}
          {workspaceContent}
        </>
      )}

      <DebriefModal
        open={showDebrief}
        onClose={() => setShowDebrief(false)}
        opportunityId={debriefOppId}
      />
    </>
  );
}
