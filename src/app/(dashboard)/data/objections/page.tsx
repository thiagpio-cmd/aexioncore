"use client";

import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeleton";

interface ObjectionData {
  overview: {
    total: number;
    globalLossRate: number;
  };
  topObjections: { title: string; count: number; lossRate: number }[];
  distribution: {
    byStage: { name: string; value: number }[];
    byPersona: { name: string; value: number }[];
    byRep: { name: string; value: number }[];
  };
}

export default function ObjectionsIntelligencePage() {
  const { data, loading, error } = useApi<ObjectionData>("/api/data/objections");

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="text-center py-20 text-muted">
        Failed to load analytical objection engine.
      </div>
    );
  }

  const { overview, topObjections, distribution } = data;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Objection Intelligence" 
        description="Aggregation of pipeline friction and direct mapping to rep, persona, and loss outcomes."
      />

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Recorded Objections</p>
          <p className="text-3xl font-bold mt-2 text-foreground">{overview.total}</p>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-5">
          <p className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Lethality (Ended in Closed Lost)
          </p>
          <p className="text-3xl font-bold mt-2 text-danger">{overview.globalLossRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Objections Ranking */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-lg font-bold mb-4">Top Impediments to Revenue</h3>
          <p className="text-xs text-muted mb-6">Ranked by sheer volume across the entire active and closed pipeline.</p>
          
          <div className="space-y-5">
            {topObjections.length === 0 ? (
              <p className="text-sm text-muted">No objections recorded in Insight logs.</p>
            ) : (
              topObjections.slice(0, 5).map((obj, idx) => (
                <div key={obj.title}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground flex items-center gap-2">
                      <span className="text-xs text-muted font-mono">{idx + 1}.</span> {obj.title}
                    </span>
                    <span className="text-muted font-mono">{obj.count} logs</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-danger">Lethality Metric</span>
                    <span className="text-xs font-bold text-danger">{obj.lossRate}% lost</span>
                  </div>
                  <div className="h-1 w-full bg-background rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-danger" style={{ width: `${obj.lossRate}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Intelligence Correlation Matrices */}
        <div className="space-y-6">
          {/* Persona Distribution */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-bold mb-3">Who is objecting? (Persona mapping)</h3>
            <ul className="space-y-2 text-sm">
              {distribution.byPersona.length === 0 ? (
                <p className="text-xs text-muted">Insufficient data.</p>
              ) : (
                distribution.byPersona.map(item => (
                  <li key={item.name} className="flex justify-between items-center">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted font-mono font-medium">{item.value}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Rep Distribution */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-bold mb-3">Who is receiving them? (Rep concentration)</h3>
            <ul className="space-y-2 text-sm">
              {distribution.byRep.length === 0 ? (
                <p className="text-xs text-muted">Insufficient data.</p>
              ) : (
                distribution.byRep.map(item => (
                  <li key={item.name} className="flex justify-between items-center">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted font-mono font-medium">{item.value}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Operational Diagnosis */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="text-lg font-bold mb-4">Coaching & Strategy Intervention</h3>
        <p className="text-xs text-muted mb-4 border-b pb-4">Objection data allows targeted skill remediation instead of generic sales training.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
              Persona Correlation Alert
            </h4>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              If "Decision Makers" hold the highest objection volume, pricing and ROI models need refactoring. If "Gatekeepers" or "Evaluators" hold the volume, features and security enablement are failing during discovery.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
              Lethality Escalation
            </h4>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Objections with a Lethality Metric &gt; 50% must trigger Executive review. Reps encountering high frequencies of lethal objections require immediate call audits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
