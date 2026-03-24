"use client";

import { useApi } from "@/lib/hooks/use-api";
import type { AllMetrics } from "@/lib/metrics/business-metrics-engine";
import { ModuleGuard } from "@/components/shared/module-guard";
import Link from "next/link";

function fmt(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

export default function CommercialModulePage() {
  return <ModuleGuard moduleKey="commercial"><CommercialContent /></ModuleGuard>;
}

function CommercialContent() {
  const { data, loading } = useApi<AllMetrics>("/api/metrics?period=90");

  if (loading) return <div className="flex items-center justify-center py-20 text-muted">Loading...</div>;

  const v = data?.volume;
  const c = data?.conversion;
  const p = data?.profitability;
  const t = data?.temporal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Commercial Module</h1>
        <p className="text-sm text-muted mt-1">CRM pipeline, sales performance, and revenue metrics</p>
      </div>

      {/* Volume Funnel */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold mb-4">Sales Volume Funnel</h2>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          {[
            { label: "Prospects", value: v?.prospects ?? 0, color: "bg-slate-100" },
            { label: "MQL", value: v?.mql ?? 0, color: "bg-blue-50" },
            { label: "SAL", value: v?.sal ?? 0, color: "bg-blue-100" },
            { label: "SQL", value: v?.sql ?? 0, color: "bg-indigo-100" },
            { label: "Proposals", value: v?.proposals ?? 0, color: "bg-purple-100" },
            { label: "Closings", value: v?.closings ?? 0, color: "bg-green-100" },
            { label: "No-Show", value: v?.noShow ?? 0, color: "bg-red-50" },
          ].map(item => (
            <div key={item.label} className={`rounded-lg ${item.color} p-3 text-center`}>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">ACV</p>
          <p className="text-xl font-bold">{fmt(p?.acv ?? 0)}</p>
          <p className="text-xs text-muted mt-1">Average Contract Value</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Win Rate</p>
          <p className="text-xl font-bold">{c?.otc ?? 0}%</p>
          <p className="text-xs text-muted mt-1">Opportunity to Close</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Sales Cycle</p>
          <p className="text-xl font-bold">{t?.avgSalesCycleDays ?? 0}d</p>
          <p className="text-xs text-muted mt-1">Avg days to close</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Pipeline</p>
          <p className="text-xl font-bold">{fmt(p?.totalPipeline ?? 0)}</p>
          <p className="text-xs text-muted mt-1">{v?.totalOpportunities ?? 0} deals</p>
        </div>
      </div>

      {/* Conversion Flow */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold mb-4">Conversion Rates</h2>
        <div className="space-y-3">
          {[
            { label: "Prospect → SAL", rate: c?.prospectToSal },
            { label: "SAL → SQL", rate: c?.salToSql },
            { label: "MQL → SQL", rate: c?.mqlToSql },
            { label: "Lead → Opportunity (LTO)", rate: c?.lto },
            { label: "Opportunity → Close (OTC)", rate: c?.otc },
            { label: "Global Conversion", rate: c?.globalConversion },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-48 text-sm text-muted">{item.label}</span>
              <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(item.rate ?? 0, 100)}%` }} />
              </div>
              <span className="w-12 text-right text-sm font-medium">{item.rate ?? 0}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Velocity */}
      {t?.stageVelocity && t.stageVelocity.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-base font-semibold mb-4">Stage Velocity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {t.stageVelocity.map(sv => (
              <div key={sv.stage} className="rounded-lg border border-border p-3 text-center">
                <p className="text-lg font-bold">{sv.avgDays}d</p>
                <p className="text-xs text-muted">{sv.stage}</p>
                <p className="text-xs text-muted">{sv.dealCount} deals</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/pipeline" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background">View Pipeline</Link>
        <Link href="/leads" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background">View Leads</Link>
        <Link href="/opportunities" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background">View Opportunities</Link>
      </div>

      <p className="text-xs text-muted">Last 90 days. ACV = avg CLOSED_WON value. MQL = fitScore ≥ 60. Sales cycle = creation to close.</p>
    </div>
  );
}
