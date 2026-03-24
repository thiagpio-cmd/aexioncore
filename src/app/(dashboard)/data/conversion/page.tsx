"use client";

import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeleton";

interface StageAnalysis {
  stage: string;
  count: number;
  totalValue: number;
  avgAgingDays: number;
  stalledRate: number;
  noNextStepRate: number;
  topOwner: string;
}

interface ConversionData {
  stageAnalysis: StageAnalysis[];
  closedAnalysis: StageAnalysis[];
  globalStalledCount: number;
  globalNoNextStepCount: number;
}

export default function ConversionByStagePage() {
  const { data, loading, error } = useApi<ConversionData>("/api/data/conversion");

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="text-center py-20 text-muted">
        Failed to load conversion matrix.
      </div>
    );
  }

  const { stageAnalysis, globalStalledCount, globalNoNextStepCount } = data;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Conversion & Pipeline Velocity" 
        description="Micro-analysis of funnel stages evaluating aging, rep concentration, and operational hygiene."
      />

      {/* Global Hygiene Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-5">
          <p className="text-xs font-semibold text-warning uppercase tracking-wider flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Global Stalled Deals (&gt; 14 Days)
          </p>
          <p className="text-3xl font-bold mt-2 text-warning">{globalStalledCount}</p>
        </div>
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-5">
          <p className="text-xs font-semibold text-danger uppercase tracking-wider flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Deals with No Next Step
          </p>
          <p className="text-3xl font-bold mt-2 text-danger">{globalNoNextStepCount}</p>
        </div>
      </div>

      {/* Active Pipeline Matrix */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-lg font-bold">Stage Micro-Analysis Matrix</h3>
          <p className="text-xs text-muted mt-1">Evaluates active pipeline velocity and hygiene bottlenecks.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted uppercase bg-background border-b border-border">
              <tr>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold text-center">Volume</th>
                <th className="px-5 py-3 font-semibold text-right">Avg Aging</th>
                <th className="px-5 py-3 font-semibold text-right">Stalled (14d+)</th>
                <th className="px-5 py-3 font-semibold text-right">No Next Step</th>
                <th className="px-5 py-3 font-semibold text-right">Top Concentrator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stageAnalysis.map((stage) => {
                const isRotting = stage.noNextStepRate > 30 || stage.stalledRate > 30;
                
                return (
                  <tr key={stage.stage} className={`hover:bg-sidebar-hover transition-colors ${isRotting ? 'bg-danger/5' : ''}`}>
                    <td className="px-5 py-4 font-medium text-foreground flex items-center gap-2">
                      {isRotting && <div className="h-2 w-2 rounded-full bg-danger"></div>}
                      {stage.stage}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="font-bold">{stage.count}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {stage.avgAgingDays} days
                    </td>
                    <td className={`px-5 py-4 text-right font-medium ${stage.stalledRate > 30 ? 'text-danger' : ''}`}>
                      {stage.stalledRate}%
                    </td>
                    <td className={`px-5 py-4 text-right font-medium ${stage.noNextStepRate > 30 ? 'text-danger' : ''}`}>
                      {stage.noNextStepRate}%
                    </td>
                    <td className="px-5 py-4 text-right truncate max-w-[120px]">
                      {stage.topOwner}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Diagnosis */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="text-lg font-bold mb-4">Operational Diagnosis & Actionability</h3>
        <p className="text-xs text-muted mb-4 border-b pb-4">Aexion Core data extraction relies on strict mathematical counting rather than AI inference. Act on these thresholds:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 text-danger">
              Stalled Deals (&gt;14 days without modification)
            </h4>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              If a stage exhibits a stall rate above 30%, the stage exit criteria is too complex or the rep lacks the collateral to advance the deal. Management should inspect <strong>{stageAnalysis.reduce((a,b)=>a.stalledRate>b.stalledRate?a:b, stageAnalysis[0])?.stage}</strong>.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 text-danger">
              No-Next-Step Hygiene
            </h4>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Deals moving without future scheduled Tasks (Pending) represent pipeline bloat and forecast decay. Reps with high concentration in stages exhibiting &gt;25% No-Next-Step rates must be coached on task hygiene immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
