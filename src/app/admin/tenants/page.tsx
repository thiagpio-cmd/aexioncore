"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry: string;
  currency: string;
  primaryColor: string;
  userCount: number;
  setupCompleted: boolean;
  createdAt: string;
  admin: { name: string; email: string; isActive: boolean } | null;
  isActive: boolean;
}

export default function TenantsPage() {
  const { headers } = useAdminSecret();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{ orgId: string; userId?: string; email?: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", { headers });
      const data = await res.json();
      if (data.success) setTenants(data.data);
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleToggle = async (orgId: string, isActive: boolean) => {
    setActionLoading(orgId);
    try {
      await fetch(`/api/admin/tenants/${orgId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: isActive ? "disable" : "enable" }),
      });
      await fetchTenants();
    } catch (err) {
      console.error("Toggle failed:", err);
    }
    setActionLoading(null);
  };

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return;
    setActionLoading(resetModal.orgId);

    // Need userId — fetch tenant detail
    try {
      const res = await fetch(`/api/admin/tenants/${resetModal.orgId}`, { headers });
      const data = await res.json();
      if (!data.success) return;

      const adminUser = data.data.users.find((u: any) => u.role === "ADMIN");
      if (!adminUser) return;

      await fetch(`/api/admin/tenants/${resetModal.orgId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", userId: adminUser.id, newPassword }),
      });
    } catch (err) {
      console.error("Reset failed:", err);
    }

    setResetModal(null);
    setNewPassword("");
    setActionLoading(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="mt-1 text-sm text-white/50">{tenants.length} organization{tenants.length !== 1 ? "s" : ""} provisioned</p>
        </div>
        <a
          href="/admin/provision"
          className="rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors"
        >
          + Provision New
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="opacity-30">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <p className="text-sm text-white/40">No tenants provisioned yet</p>
          <a href="/admin/provision" className="mt-3 inline-block text-sm text-[#2457FF] hover:underline">
            Provision your first tenant →
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Industry</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-white/40 uppercase tracking-wider">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Admin</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: t.primaryColor || "#2457FF" }}>
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        <p className="text-xs text-white/30">{t.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">{t.industry}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">{t.userCount}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">{t.admin?.email || "—"}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${t.isActive ? "bg-[#10B981]/20 text-[#10B981]" : "bg-red-500/20 text-red-400"}`}>
                      {t.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/40">
                    {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggle(t.id, t.isActive)}
                        disabled={actionLoading === t.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          t.isActive
                            ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                            : "border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10"
                        }`}
                      >
                        {t.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => setResetModal({ orgId: t.id, email: t.admin?.email || "" })}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:border-white/20 transition-colors"
                      >
                        Reset PW
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a2e] p-6">
            <h3 className="text-lg font-bold text-white mb-1">Reset Admin Password</h3>
            <p className="text-sm text-white/40 mb-4">{resetModal.email}</p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setResetModal(null); setNewPassword(""); }}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={newPassword.length < 6 || !!actionLoading}
                className="flex-1 rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
