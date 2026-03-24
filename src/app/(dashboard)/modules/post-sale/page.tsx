"use client";

import { useApi } from "@/lib/hooks/use-api";
import type { AllMetrics } from "@/lib/metrics/business-metrics-engine";
import { ModuleGuard } from "@/components/shared/module-guard";

function fmt(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

export default function PostSaleModulePage() {
  return <ModuleGuard moduleKey="post_sale"><PostSaleContent /></ModuleGuard>;
}

function PostSaleContent() {
  const { data: metrics, loading: metricsLoading } = useApi<AllMetrics>("/api/metrics");
  const { data: postSale, loading: psLoading } = useApi<any>("/api/data/post-sale");

  if (metricsLoading || psLoading) {
    return <div className="flex items-center justify-center py-20 text-muted">Loading...</div>;
  }

  const t = metrics?.temporal;
  const c = metrics?.conversion;
  const ps = postSale;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Post-Sale Module</h1>
        <p className="text-sm text-muted mt-1">Customer success, onboarding, retention, and churn intelligence</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">TTV (Time to Value)</p>
          <p className="text-xl font-bold">{t?.ttv ?? 0}d</p>
          <p className="text-xs text-muted mt-1">Avg days to activation</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Avg Contract Length</p>
          <p className="text-xl font-bold">{t?.avgContractLengthDays ?? 0}d</p>
          <p className="text-xs text-muted mt-1">Customer → churn/now</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Churn Rate</p>
          <p className="text-xl font-bold text-red-600">{c?.churnRate ?? 0}%</p>
          <p className="text-xs text-muted mt-1">Churned / total customers</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">MRR</p>
          <p className="text-xl font-bold">{fmt(metrics?.profitability?.mrr ?? 0)}</p>
          <p className="text-xs text-muted mt-1">Monthly Recurring Revenue</p>
        </div>
      </div>

      {/* Onboarding */}
      {ps?.postSale && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-base font-semibold mb-4">Onboarding Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-muted">Avg Delivery</p><p className="font-bold">{ps.postSale.avgDeliveryDays ?? 0}d</p></div>
            <div><p className="text-xs text-muted">Avg Activation</p><p className="font-bold">{ps.postSale.avgActivationDays ?? 0}d</p></div>
            <div><p className="text-xs text-muted">Onboarding Rate</p><p className="font-bold">{ps.postSale.onboardingCompletionRate ?? 0}%</p></div>
            <div><p className="text-xs text-muted">Avg Delay</p><p className="font-bold">{ps.postSale.avgDelayDays ?? 0}d</p></div>
          </div>
        </div>
      )}

      {/* Churn Analysis */}
      {ps?.churn && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-base font-semibold mb-4">Churn Analysis</h2>
          <p className="text-sm text-muted mb-3">Total churned: {ps.churn.totalChurned}</p>
          {ps.churn.byReason?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">By Reason</h3>
              {ps.churn.byReason.map((r: any) => (
                <div key={r.name} className="flex items-center justify-between">
                  <span className="text-sm text-muted">{r.name}</span>
                  <span className="text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Definitions */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-3">Metric Definitions</h2>
        <div className="space-y-2 text-xs text-muted">
          <p><strong>TTV (Time to Value):</strong> Average days from the account becoming a customer (becameCustomerAt) to activation (activationDate). Measures how quickly customers start deriving value.</p>
          <p><strong>Churn Rate:</strong> Percentage of customer accounts that have a churnDate set, relative to total customer accounts. Does not account for revenue-weighted churn.</p>
          <p><strong>MRR:</strong> Monthly Recurring Revenue = ARR / 12. ARR is the sum of all CLOSED_WON opportunity values (assumption: annual contracts).</p>
          <p><strong>Contract Length:</strong> Average days from becameCustomerAt to churnDate (or current date for active customers).</p>
        </div>
      </div>
    </div>
  );
}
