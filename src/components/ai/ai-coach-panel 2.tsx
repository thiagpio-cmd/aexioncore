"use client";

import { useState, useEffect, useCallback } from "react";

interface AICoachPanelProps {
  entityType: "lead" | "opportunity";
  entityId: string;
  compact?: boolean;
  onScheduleCall?: () => void;
  onDraftEmail?: () => void;
}

interface Signal {
  type: "positive" | "negative" | "neutral";
  text: string;
}

interface RiskAnalysis {
  level: "low" | "medium" | "high" | "critical";
  factors: string[];
  winProbability: number;
  daysToClose: number;
}

interface RecentAIAction {
  action: string;
  timestamp: string;
}

interface CoachData {
  signals: Signal[];
  nextAction: string;
  aiInsight: string | null;
  provider: "openai" | "gemini" | "deterministic";
  riskAnalysis?: RiskAnalysis;
  recentAIActions?: RecentAIAction[];
  context: {
    daysSinceCreation?: number;
    daysSinceContact?: number | null;
    daysInStage?: number;
    activityCount: number;
    taskCount?: number;
    overdueTasks?: number;
    lastActivityDays?: number;
    stakeholderCount?: number;
  };
}

const riskColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700" },
  medium: { bg: "bg-amber-50", text: "text-amber-700" },
  high: { bg: "bg-red-50", text: "text-red-700" },
  critical: { bg: "bg-red-100", text: "text-red-800" },
};

const providerLabels: Record<string, string> = {
  openai: "GPT-4o",
  gemini: "Gemini",
  deterministic: "Smart",
};

function SkeletonBlock() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="rounded-lg bg-primary/10 p-3">
        <div className="h-3 w-1/3 rounded bg-primary/15 mb-2" />
        <div className="h-3 w-full rounded bg-primary/15 mb-1.5" />
        <div className="h-3 w-3/4 rounded bg-primary/15" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-1/2 rounded bg-primary/10" />
        <div className="h-3 w-2/3 rounded bg-primary/10" />
        <div className="h-3 w-1/3 rounded bg-primary/10" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-12 rounded bg-primary/10" />
        <div className="h-12 rounded bg-primary/10" />
        <div className="h-12 rounded bg-primary/10" />
      </div>
    </div>
  );
}

export function AICoachPanel({ entityType, entityId, compact = false, onScheduleCall, onDraftEmail }: AICoachPanelProps) {
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        entityType === "lead"
          ? `/api/ai/lead-insight?leadId=${entityId}`
          : `/api/ai/opportunity-insight?opportunityId=${entityId}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Failed to load AI insights");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary animate-pulse">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-bold text-primary">AI Coach</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary animate-pulse">
            Analyzing...
          </span>
        </div>
        <SkeletonBlock />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-bold text-primary">AI Coach</span>
        </div>
        <p className="text-xs text-muted mb-3">{error || "Unable to load insights."}</p>
        <button
          onClick={fetchInsight}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Retry
        </button>
      </div>
    );
  }

  const signalIcons: Record<string, string> = {
    positive: "text-emerald-500",
    negative: "text-red-500",
    neutral: "text-gray-400",
  };

  const risk = data.riskAnalysis;
  const riskStyle = risk ? riskColors[risk.level] || riskColors.medium : null;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-bold text-primary">AI Coach</span>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {providerLabels[data.provider] || "Smart"}
        </span>
      </div>

      {/* Priority Action */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Priority Action
        </p>
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
          {data.aiInsight && (
            <p className="text-sm text-foreground leading-relaxed mb-2">{data.aiInsight}</p>
          )}
          <p className="text-xs text-foreground font-medium">{data.nextAction}</p>
          {!compact && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={onScheduleCall}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary-hover transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                Schedule Call
              </button>
              <button
                onClick={onDraftEmail}
                className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-background px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Draft Email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Deal Intelligence / Signals */}
      {(risk || (data.signals && data.signals.length > 0)) && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
            {entityType === "opportunity" ? "Deal Intelligence" : "Lead Intelligence"}
          </p>

          {risk && (
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/70">Win probability</span>
                <span className="text-xs font-semibold text-foreground">{risk.winProbability}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    risk.winProbability >= 60 ? "bg-emerald-500" : risk.winProbability >= 35 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${risk.winProbability}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/70">Risk level</span>
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${riskStyle?.bg} ${riskStyle?.text}`}>
                  {risk.level}
                </span>
              </div>
              {risk.factors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {risk.factors.map((factor, i) => (
                    <span key={i} className="inline-flex rounded-full bg-background border border-border px-1.5 py-0.5 text-[9px] text-muted">
                      {factor.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Signals */}
          {data.signals && data.signals.length > 0 && (
            <div className="space-y-1">
              {data.signals.slice(0, compact ? 3 : 5).map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 text-xs ${signalIcons[s.type] || signalIcons.neutral}`}>
                    {s.type === "positive" ? "+" : s.type === "negative" ? "\u2212" : "\u00b7"}
                  </span>
                  <span className="text-xs text-foreground/70">{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Predictions (opportunity only) */}
      {entityType === "opportunity" && risk && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Predictions
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/70">Likely to close</span>
              <span className="text-xs font-medium text-foreground">~{risk.daysToClose} days</span>
            </div>
            {data.context.daysInStage !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/70">Days in current stage</span>
                <span className="text-xs font-medium text-foreground">{data.context.daysInStage}</span>
              </div>
            )}
            {data.context.stakeholderCount !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/70">Stakeholders</span>
                <span className="text-xs font-medium text-foreground">{data.context.stakeholderCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Metrics */}
      {data.context && (
        <div className="mb-4 pt-3 border-t border-primary/10 grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{data.context.activityCount}</p>
            <p className="text-[10px] text-muted">Activities</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{data.context.taskCount ?? "\u2014"}</p>
            <p className="text-[10px] text-muted">Tasks</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {data.context.daysSinceContact ?? data.context.lastActivityDays ?? "\u2014"}
            </p>
            <p className="text-[10px] text-muted">Days Silent</p>
          </div>
        </div>
      )}

      {/* Auto-logged AI Actions */}
      {data.recentAIActions && data.recentAIActions.length > 0 && !compact && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            Auto-logged Actions
          </p>
          <div className="space-y-1">
            {data.recentAIActions.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500 mt-0.5 shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="text-xs text-foreground/70">{a.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-3 border-t border-primary/10">
        <button
          onClick={fetchInsight}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </button>
        <p className="text-[9px] text-muted">
          AI-powered coaching
        </p>
      </div>
    </div>
  );
}
