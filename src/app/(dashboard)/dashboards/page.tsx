"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { apiPost } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AIReportModal, type GeneratedReport } from "@/components/ai/ai-report-modal";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d" | "all";

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${(v / 1000).toFixed(0)}K`;
}

interface AIInsight {
  type: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  metric?: string;
}

interface AIInsightsData {
  insights: AIInsight[];
  synthesis: string | null;
  provider: string;
  metrics: Record<string, number>;
}

function AIInsightsPanel() {
  const { data, loading } = useApi<AIInsightsData>("/api/ai/insights");

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary animate-pulse">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Analyzing...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-background/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || (data.insights.length === 0 && !data.synthesis)) return null;

  const typeStyles: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", text: "text-emerald-700" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", text: "text-amber-700" },
    danger: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", text: "text-red-700" },
    info: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", text: "text-blue-700" },
  };

  const typeIcons: Record<string, React.ReactNode> = {
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>,
    warning: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    danger: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
    info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {data.provider === "openai" ? "GPT-4o" : data.provider === "gemini" ? "Gemini" : "Deterministic"}
        </span>
      </div>

      {/* LLM Executive Synthesis */}
      {data.synthesis && (
        <div className="mb-4 rounded-lg border border-primary/10 bg-white/50 p-4">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">Executive Summary</p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{data.synthesis}</p>
        </div>
      )}

      {/* Deterministic Insight Cards */}
      <div className="grid grid-cols-2 gap-3">
        {data.insights.map((insight, i) => {
          const style = typeStyles[insight.type] || typeStyles.info;
          return (
            <div key={i} className={cn("rounded-lg border p-3", style.bg, style.border)}>
              <div className="flex items-start gap-2">
                <div className={cn("mt-0.5 shrink-0", style.icon)}>
                  {typeIcons[insight.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-xs font-semibold", style.text)}>{insight.title}</p>
                    {insight.metric && (
                      <span className={cn("text-lg font-bold", style.text)}>{insight.metric}</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/70 mt-0.5 leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Report Generation Dropdown ───────────────────────────────────────────

type ReportType = "weekly_digest" | "monthly_review" | "pipeline_analysis" | "team_performance" | "forecast_accuracy";
type ReportPeriod = "7d" | "30d" | "90d";

const reportTypeOptions: { value: ReportType; label: string }[] = [
  { value: "weekly_digest", label: "Weekly Digest" },
  { value: "monthly_review", label: "Monthly Review" },
  { value: "pipeline_analysis", label: "Pipeline Analysis" },
  { value: "team_performance", label: "Team Performance" },
  { value: "forecast_accuracy", label: "Forecast Accuracy" },
];

const reportPeriodOptions: { value: ReportPeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

function GenerateReportButton() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>("weekly_digest");
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("7d");
  const [modalOpen, setModalOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const generateReport = useCallback(async (type?: ReportType, period?: ReportPeriod) => {
    const rType = type || selectedType;
    const rPeriod = period || selectedPeriod;

    setDropdownOpen(false);
    setModalOpen(true);
    setReportLoading(true);
    setReport(null);

    const { data, error } = await apiPost<GeneratedReport>("/api/ai/generate-report", {
      type: rType,
      period: rPeriod,
      format: "detailed",
    });

    if (data) {
      setReport(data);
    } else {
      console.error("Report generation failed:", error);
    }

    setReportLoading(false);
  }, [selectedType, selectedPeriod]);

  const handleRegenerate = useCallback(() => {
    if (report) {
      generateReport(report.type as ReportType, report.period as ReportPeriod);
    } else {
      generateReport();
    }
  }, [report, generateReport]);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Generate Report
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-surface p-4 shadow-xl animate-scale-in">
            <p className="text-xs font-semibold text-foreground mb-3">Generate Executive Report</p>

            {/* Report Type */}
            <div className="mb-3">
              <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">Report Type</p>
              <div className="space-y-1">
                {reportTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedType(opt.value)}
                    className={cn(
                      "w-full rounded-lg px-3 py-1.5 text-xs text-left transition-colors",
                      selectedType === opt.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-background"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="mb-4">
              <p className="text-[10px] font-medium text-muted uppercase tracking-wider mb-1.5">Period</p>
              <div className="flex items-center gap-1">
                {reportPeriodOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedPeriod(opt.value)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      selectedPeriod === opt.value
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground bg-background"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={() => generateReport()}
              className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Generate Report
            </button>
          </div>
        )}
      </div>

      <AIReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        report={report}
        loading={reportLoading}
        onRegenerate={handleRegenerate}
      />
    </>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────

export default function DashboardsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const { data, loading, error } = useApi<any>("/api/dashboard");

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
  const channels = data.channels || [];

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
            <GenerateReportButton />
            <a
              href="/api/export?type=leads"
              download
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              Export
            </a>
          </div>
        }
      />

      {/* AI Insights Panel */}
      <AIInsightsPanel />

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
                <span className="text-sm font-medium text-foreground">{ch.conversion}% conv.</span>
              </div>
            ))}
            {channels.length === 0 && <p className="text-xs text-muted">No channel data available</p>}
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

        {/* Forecast Summary */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Forecast Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Commit</span>
              <span className="text-lg font-bold text-foreground">{formatCurrency(stats.forecastCommit || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Best Case</span>
              <span className="text-lg font-bold text-foreground">{formatCurrency(stats.bestCase || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Coverage Ratio</span>
              <span className="text-lg font-bold text-foreground">{stats.coverageRatio || 0}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Closing This Month</span>
              <span className="text-sm font-semibold text-foreground">{stats.closingThisMonth || 0} deals · {formatCurrency(stats.closingValue || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">At Risk</span>
              <span className="text-sm font-semibold text-danger">{stats.atRiskDeals || 0} deals</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Conversion Funnel</h3>
        <div className="flex items-end gap-2 h-40">
          {[
            { label: "Leads", count: stats.totalLeads || 0, pct: 100, color: "bg-blue-500" },
            { label: "Contacted", count: Math.round((stats.totalLeads || 0) * 0.7), pct: 70, color: "bg-indigo-500" },
            { label: "Qualified", count: Math.round((stats.totalLeads || 0) * 0.4), pct: 40, color: "bg-purple-500" },
            { label: "Proposal", count: stats.proposalsSent || 0, pct: stats.totalLeads > 0 ? Math.round(((stats.proposalsSent || 0) / stats.totalLeads) * 100) : 25, color: "bg-amber-500" },
            { label: "Won", count: stats.wonDeals || 0, pct: stats.totalLeads > 0 ? Math.round(((stats.wonDeals || 0) / stats.totalLeads) * 100) : 12, color: "bg-emerald-500" },
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
