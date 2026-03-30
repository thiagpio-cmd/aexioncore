"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { cn } from "@/lib/utils";

interface ReportHighlight {
  type: "win" | "concern" | "trend";
  text: string;
}

interface ReportRecommendation {
  action: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  detail: string;
}

interface TeamPerformanceEntry {
  name: string;
  activities: number;
  conversions: number;
  trend: "up" | "down" | "stable";
}

export interface GeneratedReport {
  type: string;
  period: string;
  generatedAt: string;
  provider: "openai" | "deterministic";
  report: {
    executiveSummary: string;
    keyMetrics: Record<string, number>;
    highlights: ReportHighlight[];
    recommendations: ReportRecommendation[];
    teamPerformance: TeamPerformanceEntry[];
    stageDistribution: Record<string, { count: number; value: number }>;
    activityByType: Record<string, number>;
  };
}

interface AIReportModalProps {
  open: boolean;
  onClose: () => void;
  report: GeneratedReport | null;
  loading: boolean;
  onRegenerate: () => void;
}

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

const typeLabels: Record<string, string> = {
  weekly_digest: "Weekly Digest",
  monthly_review: "Monthly Review",
  pipeline_analysis: "Pipeline Analysis",
  team_performance: "Team Performance",
  forecast_accuracy: "Forecast Accuracy",
};

const periodLabels: Record<string, string> = {
  "7d": "Past 7 Days",
  "30d": "Past 30 Days",
  "90d": "Past 90 Days",
};

export function AIReportModal({ open, onClose, report, loading, onRegenerate }: AIReportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    if (!report) return;
    const text = buildPlainText(report);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        report
          ? `${typeLabels[report.type] || report.type} - ${periodLabels[report.period] || report.period}`
          : "Generating Report..."
      }
      description={
        report
          ? `Generated ${new Date(report.generatedAt).toLocaleString()} via ${report.provider === "openai" ? "GPT-4o" : "Deterministic Analysis"}`
          : undefined
      }
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary animate-pulse"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Generating executive report...</p>
            <p className="text-xs text-muted mt-1">Analyzing pipeline, leads, activities, and team performance</p>
          </div>
          <div className="w-48 h-1.5 rounded-full bg-background overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      ) : report ? (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Executive Summary */}
          <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Executive Summary</h3>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {report.report.executiveSummary}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Key Metrics</h3>
            <div className="grid grid-cols-4 gap-3">
              <MetricCard label="Pipeline Value" value={formatCurrency(report.report.keyMetrics.pipelineValue || 0)} />
              <MetricCard label="Active Deals" value={String(report.report.keyMetrics.dealCount || 0)} />
              <MetricCard label="Deals Won" value={String(report.report.keyMetrics.dealsWon || 0)} />
              <MetricCard label="Win Rate" value={`${report.report.keyMetrics.winRate || 0}%`} />
              <MetricCard label="New Leads" value={String(report.report.keyMetrics.newLeads || 0)} />
              <MetricCard label="Conversion Rate" value={`${report.report.keyMetrics.leadConversionRate || 0}%`} />
              <MetricCard label="Avg Cycle Time" value={`${report.report.keyMetrics.avgCycleTime || 0}d`} />
              <MetricCard label="Overdue Tasks" value={String(report.report.keyMetrics.overdueTasks || 0)} alert={report.report.keyMetrics.overdueTasks > 0} />
              <MetricCard label="At-Risk Deals" value={String(report.report.keyMetrics.atRiskDeals || 0)} alert={report.report.keyMetrics.atRiskDeals > 0} />
              <MetricCard label="Revenue at Risk" value={formatCurrency(report.report.keyMetrics.revenueAtRisk || 0)} alert={report.report.keyMetrics.revenueAtRisk > 0} />
              <MetricCard label="Activities" value={String(report.report.keyMetrics.totalActivities || 0)} />
              <MetricCard label="Tasks Completed" value={String(report.report.keyMetrics.completedTasks || 0)} />
            </div>
          </div>

          {/* Highlights */}
          {report.report.highlights.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Highlights</h3>
              <div className="space-y-2">
                {report.report.highlights.map((h, i) => (
                  <HighlightCard key={i} highlight={h} />
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.report.recommendations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Recommendations</h3>
              <div className="grid grid-cols-2 gap-3">
                {report.report.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Team Performance */}
          {report.report.teamPerformance.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Team Performance</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-background/50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted">Rep</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-muted">Activities</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-muted">Conversions</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-muted">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.report.teamPerformance.map((member) => (
                      <tr key={member.name} className="hover:bg-background/30">
                        <td className="px-4 py-2.5 text-sm font-medium text-foreground">{member.name}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-foreground">{member.activities}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-foreground">{member.conversions}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              member.trend === "up" && "bg-emerald-50 text-emerald-700",
                              member.trend === "down" && "bg-red-50 text-red-700",
                              member.trend === "stable" && "bg-gray-100 text-gray-600"
                            )}
                          >
                            {member.trend === "up" && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6" /></svg>
                            )}
                            {member.trend === "down" && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                            )}
                            {member.trend === "stable" && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
                            )}
                            {member.trend.charAt(0).toUpperCase() + member.trend.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={onRegenerate}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-background transition-colors flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Regenerate
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-background transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy as Text
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted">No report data available.</p>
        </div>
      )}
    </Modal>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function MetricCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", alert ? "border-amber-200 bg-amber-50/50" : "border-border bg-background/50")}>
      <p className="text-[10px] font-medium text-muted uppercase tracking-wider">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", alert ? "text-amber-700" : "text-foreground")}>{value}</p>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: ReportHighlight }) {
  const styles = {
    win: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", text: "text-emerald-700" },
    concern: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", text: "text-amber-700" },
    trend: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", text: "text-blue-700" },
  };

  const icons = {
    win: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    concern: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    trend: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  };

  const s = styles[highlight.type];

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", s.bg, s.border)}>
      <div className={cn("mt-0.5 shrink-0", s.icon)}>{icons[highlight.type]}</div>
      <p className={cn("text-sm", s.text)}>{highlight.text}</p>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: ReportRecommendation }) {
  const impactColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-green-100 text-green-700",
  };

  const effortColors = {
    high: "bg-red-50 text-red-600",
    medium: "bg-amber-50 text-amber-600",
    low: "bg-green-50 text-green-600",
  };

  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{recommendation.action}</h4>
      </div>
      <p className="text-xs text-muted leading-relaxed">{recommendation.detail}</p>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", impactColors[recommendation.impact])}>
          Impact: {recommendation.impact}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", effortColors[recommendation.effort])}>
          Effort: {recommendation.effort}
        </span>
      </div>
    </div>
  );
}

// ── Helper: Plain text export ────────────────────────────────────────────

function buildPlainText(report: GeneratedReport): string {
  const lines: string[] = [];
  const m = report.report.keyMetrics;

  lines.push(`=== ${typeLabels[report.type] || report.type} - ${periodLabels[report.period] || report.period} ===`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push(`Provider: ${report.provider === "openai" ? "GPT-4o" : "Deterministic"}`);
  lines.push("");

  lines.push("--- EXECUTIVE SUMMARY ---");
  lines.push(report.report.executiveSummary);
  lines.push("");

  lines.push("--- KEY METRICS ---");
  lines.push(`Pipeline Value: ${formatCurrency(m.pipelineValue || 0)}`);
  lines.push(`Active Deals: ${m.dealCount || 0}`);
  lines.push(`Deals Won: ${m.dealsWon || 0}`);
  lines.push(`Win Rate: ${m.winRate || 0}%`);
  lines.push(`New Leads: ${m.newLeads || 0}`);
  lines.push(`Conversion Rate: ${m.leadConversionRate || 0}%`);
  lines.push(`Avg Cycle Time: ${m.avgCycleTime || 0} days`);
  lines.push(`Overdue Tasks: ${m.overdueTasks || 0}`);
  lines.push(`At-Risk Deals: ${m.atRiskDeals || 0} (${formatCurrency(m.revenueAtRisk || 0)} at risk)`);
  lines.push("");

  if (report.report.highlights.length > 0) {
    lines.push("--- HIGHLIGHTS ---");
    for (const h of report.report.highlights) {
      lines.push(`[${h.type.toUpperCase()}] ${h.text}`);
    }
    lines.push("");
  }

  if (report.report.recommendations.length > 0) {
    lines.push("--- RECOMMENDATIONS ---");
    for (const r of report.report.recommendations) {
      lines.push(`* ${r.action} (Impact: ${r.impact}, Effort: ${r.effort})`);
      lines.push(`  ${r.detail}`);
    }
    lines.push("");
  }

  if (report.report.teamPerformance.length > 0) {
    lines.push("--- TEAM PERFORMANCE ---");
    for (const t of report.report.teamPerformance) {
      lines.push(`${t.name}: ${t.activities} activities, ${t.conversions} conversions (${t.trend})`);
    }
  }

  return lines.join("\n");
}
