"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RiskFactor {
  name: string;
  score: number;
  status: "good" | "warning" | "critical";
  detail: string;
  recommendation: string;
}

interface Forecast {
  predictedCloseDate: string | null;
  winProbability: number;
  expectedValue: number;
  revenueAtRisk: number;
}

interface DealRiskData {
  overallRisk: "low" | "medium" | "high" | "critical";
  overallScore: number;
  factors: RiskFactor[];
  aiNarrative: string | null;
  provider: "openai" | "deterministic";
  forecast: Forecast;
}

interface DealRiskCardProps {
  opportunityId: string;
  compact?: boolean;
}

// ─── Style maps ─────────────────────────────────────────────────────────────

const riskBadgeStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "LOW RISK" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "MEDIUM RISK" },
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "HIGH RISK" },
  critical: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", label: "CRITICAL" },
};

const riskBarColors: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
  critical: "bg-red-600",
};

const statusIcons: Record<string, { icon: string; color: string }> = {
  good: { icon: "\u2705", color: "text-emerald-500" },
  warning: { icon: "\u26a0\ufe0f", color: "text-amber-500" },
  critical: { icon: "\ud83d\udea8", color: "text-red-500" },
};

const factorBarColor = (score: number): string => {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
};

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DealRiskSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/10" />
          <div className="h-4 w-36 rounded bg-primary/10" />
        </div>
        <div className="h-6 w-20 rounded-full bg-primary/10" />
      </div>
      <div className="h-3 w-full rounded-full bg-primary/10 mb-6" />
      <div className="space-y-3 mb-5">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-28 rounded bg-primary/10" />
            <div className="flex-1 h-2 rounded-full bg-primary/10" />
            <div className="h-3 w-8 rounded bg-primary/10" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-primary/10" />
        ))}
      </div>
      <div className="h-16 rounded-lg bg-primary/10" />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DealRiskCard({ opportunityId, compact = false }: DealRiskCardProps) {
  const [data, setData] = useState<DealRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  const fetchRiskAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/deal-risk?opportunityId=${opportunityId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Failed to load risk analysis");
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
  }, [opportunityId]);

  useEffect(() => {
    fetchRiskAnalysis();
  }, [fetchRiskAnalysis]);

  if (loading) return <DealRiskSkeleton />;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-sm font-bold text-foreground">Deal Risk Analysis</span>
        </div>
        <p className="text-xs text-muted mb-3">{error || "Unable to load risk analysis."}</p>
        <button
          onClick={fetchRiskAnalysis}
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

  const badge = riskBadgeStyles[data.overallRisk] || riskBadgeStyles.medium;
  const barColor = riskBarColors[data.overallRisk] || riskBarColors.medium;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-sm font-bold text-foreground">Deal Risk Analysis</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {data.provider === "openai" ? "AI-Enhanced" : "Smart"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">{data.overallScore}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${badge.bg} ${badge.text} border ${badge.border}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-5">
        <div className="w-full h-2.5 rounded-full bg-background overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${data.overallScore}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted">0</span>
          <span className="text-[10px] text-muted">100</span>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="space-y-2 mb-5">
        {data.factors.map((factor) => {
          const st = statusIcons[factor.status] || statusIcons.warning;
          const isExpanded = expandedFactor === factor.name;

          return (
            <div key={factor.name}>
              <button
                onClick={() => setExpandedFactor(isExpanded ? null : factor.name)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-background transition-colors group text-left"
              >
                <span className="text-xs w-36 shrink-0 font-medium text-foreground truncate">
                  {factor.name}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${factorBarColor(factor.score)}`}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground w-8 text-right">{factor.score}</span>
                <span className="text-xs w-5 text-center" title={factor.status}>
                  {st.icon}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="ml-3 mr-3 mb-1 px-3 py-2.5 rounded-lg bg-background border border-border text-xs space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <p className="text-foreground/80">{factor.detail}</p>
                  <div className="flex items-start gap-1.5 pt-1 border-t border-border">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    <p className="text-primary font-medium">{factor.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Forecast */}
      {!compact && (
        <div className="mb-5 pt-4 border-t border-border">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
            Forecast
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-lg font-bold text-foreground">{data.forecast.winProbability}%</p>
              <p className="text-[10px] text-muted">Win Probability</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {data.forecast.predictedCloseDate
                  ? new Date(data.forecast.predictedCloseDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "--"}
              </p>
              <p className="text-[10px] text-muted">Expected Close</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-lg font-bold text-red-600">
                ${data.forecast.revenueAtRisk >= 1000
                  ? `${(data.forecast.revenueAtRisk / 1000).toFixed(0)}K`
                  : data.forecast.revenueAtRisk.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">Revenue at Risk</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Narrative */}
      {data.aiNarrative && !compact && (
        <div className="mb-4 pt-4 border-t border-border">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            AI Narrative
          </p>
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-foreground leading-relaxed">{data.aiNarrative}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <button
          onClick={fetchRiskAnalysis}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Re-analyze
        </button>
        <p className="text-[9px] text-muted">
          {data.provider === "openai" ? "Powered by GPT-4o" : "Deterministic analysis"}
        </p>
      </div>
    </div>
  );
}
