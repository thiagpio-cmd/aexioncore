"use client";

import { useState, useEffect } from "react";
import { useOrg } from "@/lib/org-context";
import { useToast } from "@/components/shared/toast";

const PRESET_COLORS = [
  "#2457FF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export default function BrandingSettingsPage() {
  const { org, refresh } = useOrg();
  const { toastSuccess, toastError } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    logoUrl: "",
    primaryColor: "#2457FF",
    secondaryColor: "#1a1a2e",
  });

  useEffect(() => {
    if (org.id) {
      setForm({
        displayName: org.displayName || org.name || "",
        logoUrl: org.logoUrl || "",
        primaryColor: org.primaryColor || "#2457FF",
        secondaryColor: org.secondaryColor || "#1a1a2e",
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
        toastSuccess("Branding updated");
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
        <h1 className="text-xl font-bold text-foreground">Branding</h1>
        <p className="text-sm text-muted mt-1">Customize your workspace appearance.</p>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Preview</h2>
        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: form.primaryColor }}
          >
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="" className="h-6 w-6 object-contain" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M16 7L23 12V20L16 25L9 20V12L16 7Z" fill="white" fillOpacity="0.9" />
                <path d="M16 12L19.5 14.5V19L16 21.5L12.5 19V14.5L16 12Z" fill={form.primaryColor} />
              </svg>
            )}
          </div>
          <span className="text-lg font-bold text-foreground">{form.displayName || "Your Company"}</span>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6 rounded-xl border border-border bg-surface p-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
          <input
            type="text"
            value={form.displayName}
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Your company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Logo URL</label>
          <input
            type="url"
            value={form.logoUrl}
            onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-muted mt-1">Square image recommended (48x48 or larger)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Primary Color</label>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="color"
              value={form.primaryColor}
              onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="h-10 w-10 rounded border border-border cursor-pointer"
            />
            <input
              type="text"
              value={form.primaryColor}
              onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, primaryColor: c }))}
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  form.primaryColor === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Secondary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.secondaryColor}
              onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))}
              className="h-10 w-10 rounded border border-border cursor-pointer"
            />
            <input
              type="text"
              value={form.secondaryColor}
              onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))}
              className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
