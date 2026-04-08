"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

export default function AnalyticsPage() {
  const { headers } = useAdminSecret();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`, { headers });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    }
    setLoading(false);
  }, [headers, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
        ))}
      </div>
    );
  }

  const o = data?.overview;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-white/40 mt-0.5">Platform growth &amp; engagement metrics</p>
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "MRR", value: fmtCurrency(o?.mrr || 0), accent: "text-[#10B981]" },
          { label: "ARR", value: fmtCurrency(o?.arr || 0), accent: "text-[#10B981]" },
          { label: "New Tenants", value: o?.newOrgs || 0, sub: `of ${o?.totalOrgs || 0} total` },
          { label: "Active Users", value: o?.activeUsers || 0, sub: `of ${o?.totalUsers || 0} total` },
          { label: "New Deals", value: o?.newDeals || 0, sub: `of ${o?.totalDeals || 0} total` },
          { label: "New Leads", value: o?.newLeads || 0, sub: `of ${o?.totalLeads || 0} total` },
          { label: "Active Subscriptions", value: o?.activeSubscriptions || 0 },
          { label: "Lifetime Revenue", value: fmtCurrency(o?.totalRevenue || 0) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] text-white/30 uppercase mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.accent || "text-white"}`}>{item.value}</p>
            {item.sub && <p className="text-[10px] text-white/20 mt-0.5">{item.sub}</p>}
          </div>
        ))}
      </div>

      {/* Growth Chart */}
      {data?.monthlyGrowth && Object.keys(data.monthlyGrowth).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tenant Growth (Monthly)</h3>
          <div className="flex items-end gap-4 h-40">
            {Object.entries(data.monthlyGrowth).map(([month, count]) => {
              const maxCount = Math.max(...Object.values(data.monthlyGrowth) as number[]);
              const heightPct = maxCount > 0 ? ((count as number) / maxCount) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-white">{count as number}</span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-[#2457FF] to-[#2457FF]/60 transition-all"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[10px] text-white/30">{(month as string).slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Tenants */}
      {data?.topTenants?.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Top Tenants by Size</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-2 text-left text-[10px] text-white/30 uppercase">#</th>
                <th className="px-5 py-2 text-left text-[10px] text-white/30 uppercase">Tenant</th>
                <th className="px-5 py-2 text-center text-[10px] text-white/30 uppercase">Users</th>
                <th className="px-5 py-2 text-center text-[10px] text-white/30 uppercase">Deals</th>
                <th className="px-5 py-2 text-center text-[10px] text-white/30 uppercase">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.topTenants.map((t: any, i: number) => (
                <tr key={t.id} className="hover:bg-white/2">
                  <td className="px-5 py-2.5 text-xs text-white/20">{i + 1}</td>
                  <td className="px-5 py-2.5">
                    <a href={`/admin/tenants/${t.id}`} className="text-sm text-white hover:text-[#2457FF] transition-colors">
                      {t.name}
                    </a>
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
