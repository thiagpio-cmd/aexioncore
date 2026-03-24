"use client";

import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeleton";

interface PersonaMetrics {
  totalAnalyzed: number;
  averageFit: number;
  personaBreakdown: {
    "Decision Maker": number;
    "Champion": number;
    "Evaluator": number;
    "Gatekeeper": number;
    "Unknown": number;
  };
  highFitCount: number;
  riskCount: number;
}

export default function PersonasAndFitPage() {
  const { data, loading, error } = useApi<PersonaMetrics>("/api/data/personas");

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="text-center py-20 text-muted">
        Failed to load intelligence data.
      </div>
    );
  }

  const { totalAnalyzed, averageFit, personaBreakdown, highFitCount, riskCount } = data;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Personas & Fit Engine" 
        description="Heuristic intelligence analysis across all active pipeline leads based on explicit mechanical signals."
      />

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Active Leads Analyzed</p>
          <p className="text-3xl font-bold mt-2 text-foreground">{totalAnalyzed}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Avg Fit Score
          </p>
          <p className="text-3xl font-bold mt-2 text-primary">{averageFit}</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/5 p-5">
          <p className="text-xs font-semibold text-success uppercase tracking-wider flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            High Fit (70+)
          </p>
          <p className="text-3xl font-bold mt-2 text-success">{highFitCount}</p>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-5">
          <p className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            At Risk (&lt;40)
          </p>
          <p className="text-3xl font-bold mt-2 text-danger">{riskCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Persona Distribution */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-lg font-bold mb-4">Pipeline Persona Distribution</h3>
          <p className="text-xs text-muted mb-6">Classifications inferred organically from designated job titles in active leads.</p>
          
          <div className="space-y-4">
            {Object.entries(personaBreakdown).map(([persona, count]) => {
              const percentage = totalAnalyzed === 0 ? 0 : Math.round((count / totalAnalyzed) * 100);
              
              let barColor = "bg-primary";
              if (persona === "Decision Maker") barColor = "bg-success";
              if (persona === "Unknown") barColor = "bg-muted-foreground/30";
              if (persona === "Gatekeeper") barColor = "bg-warning";

              return (
                <div key={persona}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{persona}</span>
                    <span className="text-muted font-mono">{count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Engine Transparency Log */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-lg font-bold mb-4">Motor Transparency Rules</h3>
          <p className="text-xs text-muted mb-4 border-b pb-4">Aexion Core exclusively utilizes explicit relational matching over generative AI to ensure deterministic precision and explainability.</p>
          
          <div className="space-y-4 pt-2">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-5 w-5 bg-primary/10 text-primary rounded inline-flex items-center justify-center text-xs">1</span>
                Persona Inference
              </h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Tokens like "ceo", "founder", or "vp" instantly map to Decision Maker context. Operatives match against Champion dictionaries. Free-text entries are routed safely to Evaluator states.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-5 w-5 bg-primary/10 text-primary rounded inline-flex items-center justify-center text-xs">2</span>
                Fit Scoring Mechanics
              </h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Base of 30. Executive proxies add +20. Valid B2B domain indicators add +10. Free-mail domains subtract -10. Complete contact sets accrue +10. Explicit bounds logic.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
