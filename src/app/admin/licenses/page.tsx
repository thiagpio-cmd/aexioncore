"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

interface License {
  id: string;
  key: string;
  status: string;
  planTier: string | null;
  maxActivations: number;
  currentActivations: number;
  activatedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-[#10B981]/20 text-[#10B981]",
  REVOKED: "bg-red-500/20 text-red-400",
  EXPIRED: "bg-white/10 text-white/40",
};

export default function LicensesPage() {
  const { headers } = useAdminSecret();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({
    planTier: "PROFESSIONAL",
    count: 1,
    maxActivations: 1,
    expiresAt: "",
    notes: "",
  });
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/licenses", { headers });
      const data = await res.json();
      if (data.success) setLicenses(data.data);
    } catch (err) {
      console.error("Failed to fetch licenses:", err);
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);

  const generate = async () => {
    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(genForm),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedKeys(data.data.map((l: any) => l.key));
        await fetchLicenses();
      }
    } catch (err) {
      console.error("Generate failed:", err);
    }
  };

  const revokeLicense = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/licenses/${id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      await fetchLicenses();
    } catch (err) {
      console.error("Revoke failed:", err);
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">License Keys</h1>
          <p className="text-sm text-white/40 mt-0.5">{licenses.length} key{licenses.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowGenerate(true); setGeneratedKeys([]); }}
          className="rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors"
        >
          + Generate Keys
        </button>
      </div>

      {/* License Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
          ))}
        </div>
      ) : licenses.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <p className="text-sm text-white/40">No license keys generated yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Key</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Tier</th>
                <th className="px-5 py-3 text-center text-[10px] text-white/30 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Assigned To</th>
                <th className="px-5 py-3 text-center text-[10px] text-white/30 uppercase">Activations</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Expires</th>
                <th className="px-5 py-3 text-right text-[10px] text-white/30 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {licenses.map((lic) => (
                <tr key={lic.id} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <code className="text-xs text-[#2457FF] font-mono">{lic.key}</code>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/60">{lic.planTier || "—"}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[lic.status] || STATUS_COLORS.ACTIVE}`}>
                      {lic.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/60">
                    {lic.organization ? lic.organization.name : "—"}
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-white/60">
                    {lic.currentActivations}/{lic.maxActivations}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">
                    {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {lic.status === "ACTIVE" && (
                      <button
                        onClick={() => revokeLicense(lic.id)}
                        disabled={actionLoading === lic.id}
                        className="text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded px-2 py-1 transition-colors disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-6">
            <h3 className="text-lg font-bold text-white mb-4">Generate License Keys</h3>

            {generatedKeys.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[#10B981]">Generated {generatedKeys.length} key(s):</p>
                <div className="bg-black/30 rounded-lg p-3 space-y-1">
                  {generatedKeys.map((key) => (
                    <code key={key} className="block text-sm text-[#2457FF] font-mono">{key}</code>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKeys.join("\n"));
                  }}
                  className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => { setShowGenerate(false); setGeneratedKeys([]); }}
                  className="w-full rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={genForm.planTier}
                  onChange={(e) => setGenForm({ ...genForm, planTier: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                >
                  {["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/30 mb-0.5 block">Count</label>
                    <input
                      type="number" min={1} max={50} value={genForm.count}
                      onChange={(e) => setGenForm({ ...genForm, count: parseInt(e.target.value) || 1 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 mb-0.5 block">Max Activations</label>
                    <input
                      type="number" min={1} value={genForm.maxActivations}
                      onChange={(e) => setGenForm({ ...genForm, maxActivations: parseInt(e.target.value) || 1 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-white/30 mb-0.5 block">Expires At (optional)</label>
                  <input
                    type="date" value={genForm.expiresAt}
                    onChange={(e) => setGenForm({ ...genForm, expiresAt: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                  />
                </div>
                <textarea
                  placeholder="Notes (optional)" value={genForm.notes}
                  onChange={(e) => setGenForm({ ...genForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none resize-none"
                  rows={2}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowGenerate(false)}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generate}
                    className="flex-1 rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors"
                  >
                    Generate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
