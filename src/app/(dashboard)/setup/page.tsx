"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/org-context";

const ALL_MODULES = [
  { key: "commercial", label: "Commercial", description: "Sales pipeline, deals, and revenue tracking" },
  { key: "data", label: "Data & Analytics", description: "Dashboards, personas, conversion, and forecasting" },
  { key: "reports", label: "Reports", description: "Executive and consulting reports" },
  { key: "automation", label: "Automation", description: "Workflow automation and rules" },
  { key: "post_sale", label: "Post-Sale", description: "Customer success, churn tracking, and retention" },
  { key: "playbooks", label: "Playbooks", description: "Sales playbooks and guided workflows" },
];

const INDUSTRIES = [
  "SaaS / Technology", "Financial Services", "Healthcare", "E-commerce",
  "Manufacturing", "Professional Services", "Education", "Other",
];

const CURRENCIES = [
  { code: "BRL", label: "R$ — Brazilian Real" },
  { code: "USD", label: "$ — US Dollar" },
  { code: "EUR", label: "€ — Euro" },
];

export default function SetupPage() {
  const router = useRouter();
  const { org, refresh } = useOrg();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2457FF");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  useEffect(() => {
    if (org.id) {
      setDisplayName(org.displayName || org.name || "");
      setPrimaryColor(org.primaryColor || "#2457FF");
      setIndustry(org.industry || "");
      setCurrency(org.defaultCurrency || "BRL");
      setEnabledModules(org.enabledModules || ALL_MODULES.map(m => m.key));
      setStep(org.setupStep || 0);
    }
  }, [org]);

  const save = async (data: Record<string, any>, nextStep: number) => {
    setSaving(true);
    try {
      await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, setupStep: nextStep }),
      });
      setStep(nextStep);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const completeSetup = async () => {
    setSaving(true);
    try {
      await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupCompleted: true, setupStep: 3 }),
      });
      refresh();
      router.push("/");
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (key: string) => {
    setEnabledModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="mx-auto max-w-2xl py-12 px-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">Setup your workspace</h1>
      <p className="text-muted mb-8">Configure your tenant environment in 3 steps.</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-10">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step > i ? "bg-green-500 text-white" : step === i ? "bg-primary text-white" : "bg-border text-muted"
            }`}>
              {step > i ? "✓" : i + 1}
            </div>
            {i < 2 && <div className={`h-0.5 w-12 ${step > i ? "bg-green-500" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Branding */}
      {step === 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Step 1: Branding</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Your company name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-32 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono"
              />
              <div className="h-8 w-24 rounded" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
          <button
            onClick={() => save({ displayName, primaryColor }, 1)}
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Saving..." : "Next: Industry"}
          </button>
        </div>
      )}

      {/* Step 2: Industry & Currency */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Step 2: Industry & Currency</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Default Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="rounded-lg border border-border px-4 py-2 text-sm">Back</button>
            <button
              onClick={() => save({ industry, defaultCurrency: currency }, 2)}
              disabled={saving}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Next: Modules"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Modules */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Step 3: Enable Modules</h2>
          <p className="text-sm text-muted">Select which modules to activate for your workspace.</p>
          <div className="space-y-3">
            {ALL_MODULES.map(mod => (
              <label
                key={mod.key}
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  enabledModules.includes(mod.key) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabledModules.includes(mod.key)}
                  onChange={() => toggleModule(mod.key)}
                  className="rounded"
                />
                <div>
                  <div className="font-medium text-sm">{mod.label}</div>
                  <div className="text-xs text-muted">{mod.description}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-lg border border-border px-4 py-2 text-sm">Back</button>
            <button
              onClick={async () => {
                await save({ enabledModules }, 3);
                await completeSetup();
              }}
              disabled={saving}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Finishing..." : "Complete Setup"}
            </button>
          </div>
        </div>
      )}

      {/* Already completed */}
      {step >= 3 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-lg font-semibold mb-2">Setup Complete</h2>
          <p className="text-muted mb-6">Your workspace is configured and ready.</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
