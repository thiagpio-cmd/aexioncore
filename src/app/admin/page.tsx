"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

interface AnalyticsData {
  overview: {
    totalOrgs: number;
    newOrgs: number;
    totalUsers: number;
    activeUsers: number;
    totalDeals: number;
    newDeals: number;
    totalLeads: number;
    newLeads: number;
    activeSubscriptions: number;
    totalRevenue: number;
    mrr: number;
    arr: number;
  };
  subscriptionDistribution: Array<{ status: string; _count: { id: number } }>;
  monthlyGrowth: Record<string, number>;
  topTenants: Array<{
    id: string;
    name: string;
    slug: string;
    _count: { users: number; opportunities: number; leads: number };
  }>;
}

interface UsageData {
  totals: { organizations: number; users: number; deals: number; leads: number; integrations: number };
  subscriptions: { active: number; trialing: number; canceled: number };
  usageAlerts: Array<{ orgId: string; orgName: string; metric: string; usagePercent: number }>;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { headers } = useAdminSecret();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, usageRes] = await Promise.all([
        fetch(`/api/admin/analytics?period=${period}`, { headers }),
        fetch("/api/admin/usage", { headers }),
      ]);
      const [aData, uData] = await Promise.all([analyticsRes.json(), usageRes.json()]);
      if (aData.success) setAnalytics(aData.data);
      if (uData.success) setUsage(uData.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
    setLoading(false);
  }, [headers, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const o = analytics?.overview;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white/40 mt-0.5">Platform overview &amp; health</p>
        </div>
        <div className="flex items-center gap-2">
          {["7d", "30d", "90d", "365d"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-[#2457FF] text-white"
                  : "border border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Revenue</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="MRR" value={fmtCurrency(o?.mrr || 0)} accent="text-[#10B981]" />
          <StatCard label="ARR" value={fmtCurrency(o?.arr || 0)} accent="text-[#10B981]" />
          <StatCard label="Active Subscriptions" value={o?.activeSubscriptions || 0} />
          <StatCard
            label="Total Revenue"
            value={fmtCurrency(o?.totalRevenue || 0)}
            sub="Lifetime paid invoices"
          />
        </div>
      </div>

      {/* Platform KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Platform</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Tenants" value={o?.totalOrgs || 0} sub={`+${o?.newOrgs || 0} new`} />
          <StatCard label="Total Users" value={o?.totalUsers || 0} sub={`${o?.activeUsers || 0} active`} />
          <StatCard label="Total Deals" value={o?.totalDeals || 0} sub={`+${o?.newDeals || 0} new`} />
          <StatCard label="Total Leads" value={o?.totalLeads || 0} sub={`+${o?.newLeads || 0} new`} />
        </div>
      </div>

      {/* Subscription Distribution + Usage Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sub distribution */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Subscription Status</h3>
          <div className="space-y-3">
            {[
              { label: "Active", value: usage?.subscriptions.active || 0, color: "#10B981" },
              { label: "Trialing", value: usage?.subscriptions.trialing || 0, color: "#F59E0B" },
              { label: "Canceled", value: usage?.subscriptions.canceled || 0, color: "#EF4444" },
            ].map((item) => {
              const total =
                (usage?.subscriptions.active || 0) +
                (usage?.subscriptions.trialing || 0) +
                (usage?.subscriptions.canceled || 0);
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{item.label}</span>
                    <span className="text-xs font-semibold text-white">
                      {item.value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Usage Alerts */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Usage Alerts</h3>
          {!usage?.usageAlerts?.length ? (
            <p className="text-xs text-white/30">No usage warnings. All tenants within limits.</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {usage.usageAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-white">{alert.orgName}</p>
                    <p className="text-[10px] text-white/40">{alert.metric}</p>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      alert.usagePercent >= 100 ? "text-red-400" : "text-amber-400"
                    }`}
                  >
                    {alert.usagePercent}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Growth */}
      {analytics?.monthlyGrowth && Object.keys(analytics.monthlyGrowth).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Monthly Growth (New Tenants)</h3>
          <div className="flex items-end gap-3 h-32">
            {Object.entries(analytics.monthlyGrowth).map(([month, count]) => {
              const maxCount = Math.max(...Object.values(analytics.monthlyGrowth));
              const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-white">{count}</span>
                  <div
                    className="w-full rounded-t bg-[#2457FF] transition-all"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[9px] text-white/30">{month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Tenants */}
      {analytics?.topTenants && analytics.topTenants.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Top Tenants</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-2 text-left text-[10px] text-white/30 uppercase">Tenant</th>
                <th className="px-5 py-2 text-center text-[10px] text-white/30 uppercase">Users</th>
                <th className="px-5 py-2 text-center text-[10px] text-white/30 uppercase">Deals</th>
                <th className="px-5 py-2 text-center text-[10px] text-white/30 uppercase">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analytics.topTenants.map((t) => (
                <tr key={t.id} className="hover:bg-white/2">
                  <td className="px-5 py-2.5">
                    <p className="text-sm text-white font-medium">{t.name}</p>
                    <p className="text-[10px] text-white/30">{t.slug}</p>
                  </td>
                  <td className="px-5 py-2.5 text-center text-sm text-white/60">{t._count.users}</td>
                  <td className="px-5 py-2.5 text-center text-sm text-white/60">{t._count.opportunities}</td>
                  <td className="px-5 py-2.5 text-center text-sm text-white/60">{t._count.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
