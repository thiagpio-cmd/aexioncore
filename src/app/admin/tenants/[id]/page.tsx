"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";
import { useParams } from "next/navigation";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  primaryColor: string;
  enabledModules: string;
  setupCompleted: boolean;
  createdAt: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    workspace: string;
    isActive: boolean;
  }>;
  teams: Array<{ id: string; name: string }>;
  pipelines: Array<{ id: string; name: string; stages: any[] }>;
  _count?: { leads: number; opportunities: number };
}

interface SubscriptionInfo {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  plan: { id: string; name: string; tier: string };
}

interface UsageSummary {
  subscription: any;
  usage: Record<string, { allowed: boolean; current: number; limit: number; usagePercent: number; warning: boolean }>;
  hasWarnings: boolean;
  hasOverages: boolean;
}

type Tab = "overview" | "users" | "subscription" | "usage" | "audit";

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { headers } = useAdminSecret();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [usageData, setUsageData] = useState<UsageSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, subsRes, usageRes, auditRes] = await Promise.all([
        fetch(`/api/admin/tenants/${id}`, { headers }),
        fetch(`/api/admin/subscriptions?organizationId=${id}`, { headers }),
        fetch(`/api/admin/usage/${id}`, { headers }),
        fetch(`/api/admin/audit?targetType=organization&targetId=${id}&limit=20`, { headers }),
      ]);
      const [tData, sData, uData, aData] = await Promise.all([
        tenantRes.json(), subsRes.json(), usageRes.json(), auditRes.json(),
      ]);
      if (tData.success) setTenant(tData.data);
      if (sData.success) setSubscriptions(sData.data);
      if (uData.success) setUsageData(uData.data.current);
      if (aData.success) setAuditLogs(aData.data);
    } catch (err) {
      console.error("Tenant detail fetch error:", err);
    }
    setLoading(false);
  }, [id, headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUserUpdate = async (userId: string, changes: any) => {
    try {
      await fetch(`/api/admin/tenants/${id}/users`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...changes }),
      });
      setEditingUser(null);
      fetchAll();
    } catch (err) {
      console.error("User update failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
        <p className="text-white/40">Tenant not found</p>
        <a href="/admin/tenants" className="mt-3 inline-block text-sm text-[#2457FF]">
          Back to Tenants
        </a>
      </div>
    );
  }

  const activeSub = subscriptions.find((s) => s.status === "ACTIVE" || s.status === "TRIALING");
  const modules = (() => {
    try { return JSON.parse(tenant.enabledModules || "[]"); } catch { return []; }
  })();

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: `Users (${tenant.users?.length || 0})` },
    { key: "subscription", label: "Subscription" },
    { key: "usage", label: "Usage" },
    { key: "audit", label: "Audit Log" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <a href="/admin/tenants" className="text-white/40 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: tenant.primaryColor || "#2457FF" }}
          >
            {tenant.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{tenant.name}</h1>
            <p className="text-xs text-white/40">
              {tenant.slug} &middot; {tenant.industry || "—"} &middot;
              Created {new Date(tenant.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeSub && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              activeSub.status === "ACTIVE" ? "bg-[#10B981]/20 text-[#10B981]" :
              activeSub.status === "TRIALING" ? "bg-amber-500/20 text-amber-400" :
              "bg-white/10 text-white/50"
            }`}>
              {activeSub.plan.tier} — {activeSub.status}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-[#2457FF] text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-white/30 uppercase">Users</p>
              <p className="text-xl font-bold text-white">{tenant.users?.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-white/30 uppercase">Teams</p>
              <p className="text-xl font-bold text-white">{tenant.teams?.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-white/30 uppercase">Pipelines</p>
              <p className="text-xl font-bold text-white">{tenant.pipelines?.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-white/30 uppercase">Setup</p>
              <p className="text-xl font-bold text-white">{tenant.setupCompleted ? "Done" : "Pending"}</p>
            </div>
          </div>
          {/* Modules */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Enabled Modules</h3>
            <div className="flex flex-wrap gap-2">
              {modules.map((m: string) => (
                <span key={m} className="rounded-full bg-[#2457FF]/10 px-3 py-1 text-xs text-[#2457FF] font-medium">
                  {m}
                </span>
              ))}
              {modules.length === 0 && <p className="text-xs text-white/30">No modules configured</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">User</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Role</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Workspace</th>
                <th className="px-5 py-3 text-center text-[10px] text-white/30 uppercase">Status</th>
                <th className="px-5 py-3 text-right text-[10px] text-white/30 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(tenant.users || []).map((u) => (
                <tr key={u.id} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <p className="text-sm text-white font-medium">{u.name}</p>
                    <p className="text-[10px] text-white/30">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {editingUser === u.id ? (
                      <select
                        defaultValue={u.role}
                        onChange={(e) => handleUserUpdate(u.id, { role: e.target.value })}
                        className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs text-white"
                      >
                        {["VIEWER", "SDR", "CLOSER", "REVOPS", "MANAGER", "DIRECTOR", "ADMIN"].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-white/60">{u.role}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/60">{u.workspace}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.isActive ? "bg-[#10B981]/20 text-[#10B981]" : "bg-red-500/20 text-red-400"
                    }`}>
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(editingUser === u.id ? null : u.id)}
                        className="text-[10px] text-white/40 hover:text-white border border-white/10 rounded px-2 py-1"
                      >
                        {editingUser === u.id ? "Done" : "Edit"}
                      </button>
                      <button
                        onClick={() => handleUserUpdate(u.id, { isActive: !u.isActive })}
                        className={`text-[10px] border rounded px-2 py-1 ${
                          u.isActive
                            ? "border-red-500/30 text-red-400"
                            : "border-[#10B981]/30 text-[#10B981]"
                        }`}
                      >
                        {u.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "subscription" && (
        <div className="space-y-4">
          {subscriptions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-sm text-white/40">No subscription assigned</p>
              <a
                href="/admin/plans"
                className="mt-2 inline-block text-xs text-[#2457FF] hover:underline"
              >
                Assign a plan &rarr;
              </a>
            </div>
          ) : (
            subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-semibold text-white">{sub.plan.name}</span>
                    <span className="ml-2 text-xs text-white/30">{sub.plan.tier}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    sub.status === "ACTIVE" ? "bg-[#10B981]/20 text-[#10B981]" :
                    sub.status === "TRIALING" ? "bg-amber-500/20 text-amber-400" :
                    sub.status === "CANCELED" ? "bg-red-500/20 text-red-400" :
                    "bg-white/10 text-white/40"
                  }`}>
                    {sub.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-white/30">Billing Cycle</p>
                    <p className="text-white">{sub.billingCycle}</p>
                  </div>
                  <div>
                    <p className="text-white/30">Period End</p>
                    <p className="text-white">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
                  </div>
                  {sub.trialEnd && (
                    <div>
                      <p className="text-white/30">Trial End</p>
                      <p className="text-white">{new Date(sub.trialEnd).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-4">
          {!usageData ? (
            <p className="text-sm text-white/40">No usage data available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(usageData.usage).map(([metric, data]) => {
                const d = data as any;
                const isUnlimited = d.limit <= 0;
                return (
                  <div
                    key={metric}
                    className={`rounded-xl border p-4 ${
                      !d.allowed
                        ? "border-red-500/30 bg-red-500/5"
                        : d.warning
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/50 uppercase">{metric}</span>
                      {!d.allowed && (
                        <span className="text-[9px] font-semibold text-red-400 bg-red-500/20 rounded px-1.5 py-0.5">OVER LIMIT</span>
                      )}
                    </div>
                    <p className="text-lg font-bold text-white">
                      {d.current}{" "}
                      <span className="text-sm font-normal text-white/30">
                        / {isUnlimited ? "Unlimited" : d.limit}
                      </span>
                    </p>
                    {!isUnlimited && (
                      <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            !d.allowed ? "bg-red-500" : d.warning ? "bg-amber-500" : "bg-[#2457FF]"
                          }`}
                          style={{ width: `${Math.min(d.usagePercent, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          {auditLogs.length === 0 ? (
            <p className="p-6 text-sm text-white/30 text-center">No audit logs for this tenant</p>
          ) : (
            <div className="divide-y divide-white/5">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white font-medium">{log.action}</p>
                    <p className="text-[10px] text-white/30">
                      by {log.adminIdentifier} &middot; {log.targetType}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/20">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
