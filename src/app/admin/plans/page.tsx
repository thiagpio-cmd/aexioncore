"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: string;
  maxSeats: number;
  maxDeals: number;
  maxLeads: number;
  maxStorageMB: number;
  maxAICallsPerMonth: number;
  maxIntegrations: number;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  trialDays: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  enabledModules: string | null;
  enabledFeatures: string | null;
  _count: { subscriptions: number };
}

const TIERS = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE", "CUSTOM"];
const TIER_COLORS: Record<string, string> = {
  FREE: "bg-white/10 text-white/50",
  STARTER: "bg-blue-500/20 text-blue-400",
  PROFESSIONAL: "bg-purple-500/20 text-purple-400",
  ENTERPRISE: "bg-amber-500/20 text-amber-400",
  CUSTOM: "bg-[#10B981]/20 text-[#10B981]",
};

const fmtPrice = (cents: number) =>
  cents === 0 ? "—" : `$${(cents / 100).toFixed(0)}`;

export default function PlansPage() {
  const { headers } = useAdminSecret();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    tier: "STARTER",
    maxSeats: 5,
    maxDeals: 100,
    maxLeads: 500,
    maxStorageMB: 1024,
    maxAICallsPerMonth: 200,
    maxIntegrations: 3,
    priceMonthly: 0,
    priceAnnual: 0,
    trialDays: 14,
  });

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plans?active=false", { headers });
      const data = await res.json();
      if (data.success) setPlans(data.data);
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const seedDefaults = async () => {
    setSeedLoading(true);
    try {
      await fetch("/api/admin/plans/seed", {
        method: "POST",
        headers,
      });
      await fetchPlans();
    } catch (err) {
      console.error("Seed failed:", err);
    }
    setSeedLoading(false);
  };

  const createPlan = async () => {
    try {
      await fetch("/api/admin/plans", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({
        name: "", slug: "", description: "", tier: "STARTER",
        maxSeats: 5, maxDeals: 100, maxLeads: 500, maxStorageMB: 1024,
        maxAICallsPerMonth: 200, maxIntegrations: 3, priceMonthly: 0, priceAnnual: 0, trialDays: 14,
      });
      await fetchPlans();
    } catch (err) {
      console.error("Create failed:", err);
    }
  };

  const togglePlan = async (planId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      await fetchPlans();
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Plans</h1>
          <p className="text-sm text-white/40 mt-0.5">{plans.length} plan{plans.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-2">
          {plans.length === 0 && (
            <button
              onClick={seedDefaults}
              disabled={seedLoading}
              className="rounded-lg border border-[#10B981]/30 px-4 py-2.5 text-sm font-medium text-[#10B981] hover:bg-[#10B981]/10 transition-colors disabled:opacity-50"
            >
              {seedLoading ? "Seeding..." : "Seed Defaults"}
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors"
          >
            + Create Plan
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <p className="text-sm text-white/40 mb-2">No plans configured</p>
          <p className="text-xs text-white/20">Seed defaults to get started with Free, Starter, Professional, and Enterprise plans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 flex flex-col ${
                plan.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-white/2 opacity-60"
              }`}
            >
              {/* Tier badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${TIER_COLORS[plan.tier] || TIER_COLORS.CUSTOM}`}>
                  {plan.tier}
                </span>
                {!plan.isActive && (
                  <span className="text-[10px] text-red-400">Inactive</span>
                )}
              </div>

              <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
              {plan.description && (
                <p className="text-[11px] text-white/40 mb-3 line-clamp-2">{plan.description}</p>
              )}

              {/* Pricing */}
              <div className="mb-3">
                <span className="text-2xl font-bold text-white">{fmtPrice(plan.priceMonthly)}</span>
                {plan.priceMonthly > 0 && (
                  <span className="text-xs text-white/30">/mo</span>
                )}
                {plan.priceAnnual > 0 && (
                  <p className="text-[10px] text-white/20 mt-0.5">
                    {fmtPrice(plan.priceAnnual)}/yr
                  </p>
                )}
              </div>

              {/* Limits */}
              <div className="flex-1 space-y-1 mb-3">
                {[
                  { label: "Seats", val: plan.maxSeats },
                  { label: "Deals", val: plan.maxDeals },
                  { label: "Leads", val: plan.maxLeads },
                  { label: "AI Calls", val: plan.maxAICallsPerMonth },
                  { label: "Integrations", val: plan.maxIntegrations },
                  { label: "Storage", val: plan.maxStorageMB > 0 ? `${plan.maxStorageMB}MB` : "Unlimited" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-white/30">{item.label}</span>
                    <span className="text-white/60">
                      {typeof item.val === "number"
                        ? item.val <= 0 ? "Unlimited" : item.val.toLocaleString()
                        : item.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[10px] text-white/20">{plan._count.subscriptions} subs</span>
                <button
                  onClick={() => togglePlan(plan.id, plan.isActive)}
                  className={`text-[10px] border rounded px-2 py-1 ${
                    plan.isActive
                      ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                      : "border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10"
                  } transition-colors`}
                >
                  {plan.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Create Plan</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text" placeholder="Plan name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none"
                />
                <input
                  type="text" placeholder="slug (e.g. starter)" value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none"
                />
              </div>
              <textarea
                placeholder="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none resize-none"
                rows={2}
              />
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#2457FF] focus:outline-none"
              >
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-[10px] text-white/30 uppercase mt-2">Limits</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ["maxSeats", "Seats"],
                  ["maxDeals", "Deals"],
                  ["maxLeads", "Leads"],
                  ["maxStorageMB", "Storage (MB)"],
                  ["maxAICallsPerMonth", "AI Calls/mo"],
                  ["maxIntegrations", "Integrations"],
                ] as [string, string][]).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[10px] text-white/30 mb-0.5 block">{label}</label>
                    <input
                      type="number"
                      value={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/30 uppercase mt-2">Pricing (cents)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 mb-0.5 block">Monthly</label>
                  <input
                    type="number" value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 mb-0.5 block">Annual</label>
                  <input
                    type="number" value={form.priceAnnual}
                    onChange={(e) => setForm({ ...form, priceAnnual: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 mb-0.5 block">Trial Days</label>
                  <input
                    type="number" value={form.trialDays}
                    onChange={(e) => setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPlan}
                disabled={!form.name || !form.slug}
                className="flex-1 rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors disabled:opacity-50"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
