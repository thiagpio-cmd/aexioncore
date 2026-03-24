"use client";

import { useState, useEffect } from "react";
import { useOrg } from "@/lib/org-context";
import { apiPut } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";

const INDUSTRIES = [
  "SaaS / Technology", "Financial Services", "Healthcare", "E-commerce",
  "Manufacturing", "Professional Services", "Education", "Other",
];
const CURRENCIES = [
  { code: "USD", label: "$ — US Dollar" },
  { code: "EUR", label: "€ — Euro" },
  { code: "GBP", label: "£ — British Pound" },
  { code: "BRL", label: "R$ — Brazilian Real" },
];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Sao_Paulo", "Europe/London",
  "Europe/Berlin", "Asia/Tokyo",
];

export default function OrganizationSettingsPage() {
  const { org, refresh } = useOrg();
  const { toastSuccess, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    industry: "",
    defaultCurrency: "USD",
    timezone: "America/New_York",
    fiscalYearStart: 1,
  });

  useEffect(() => {
    if (org.id) {
      setForm({
        displayName: org.displayName || org.name || "",
        industry: org.industry || "",
        defaultCurrency: org.defaultCurrency || "USD",
        timezone: org.timezone || "America/New_York",
        fiscalYearStart: org.fiscalYearStart || 1,
      });
    }
  }, [org]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toastSuccess("Organization settings saved");
        refresh();
      } else {
        toastError(data.error?.message || "Failed to save");
      }
    } catch {
      toastError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Organization Settings</h1>
        <p className="text-sm text-muted mt-1">Configure your organization profile and preferences.</p>
      </div>

      <div className="space-y-6 rounded-xl border border-border bg-surface p-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Organization Name</label>
          <input
            type="text"
            value={form.displayName}
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
          <select
            value={form.industry}
            onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Default Currency</label>
            <select
              value={form.defaultCurrency}
              onChange={e => setForm(f => ({ ...f, defaultCurrency: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Fiscal Year Start</label>
          <select
            value={form.fiscalYearStart}
            onChange={e => setForm(f => ({ ...f, fiscalYearStart: parseInt(e.target.value) }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
