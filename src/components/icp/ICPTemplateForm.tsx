"use client";

import { useState, useCallback } from "react";
import { GlassCard } from "@/components/design-system/GlassCard";
import { apiPost, apiPut } from "@/lib/hooks/use-api";

interface ICPFormData {
  name: string;
  bigFiveProfile: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  motivationProfile: {
    autonomy: number;
    competence: number;
    relatedness: number;
  };
  decisionStyle: string;
  riskTolerance: string;
  valueDrivers: string[];
  idealIndustries: string;
  idealCompanySizeMin: number | null;
  idealCompanySizeMax: number | null;
  idealAnnualRevenueMinBRL: number | null;
  idealAnnualRevenueMaxBRL: number | null;
}

interface ICPTemplateFormProps {
  editData?: {
    id: string;
    name: string;
    bigFiveProfile?: string | null;
    motivationProfile?: string | null;
    decisionStyle?: string | null;
    riskTolerance?: string | null;
    valueDrivers?: string | null;
    idealIndustries?: string | null;
    idealCompanySizeMin?: number | null;
    idealCompanySizeMax?: number | null;
    idealAnnualRevenueMinBRL?: number | null;
    idealAnnualRevenueMaxBRL?: number | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

const VALUE_DRIVER_OPTIONS = [
  { value: "ROI", label: "ROI" },
  { value: "PRICE", label: "Price" },
  { value: "RELATIONSHIP", label: "Relationship" },
  { value: "BRAND", label: "Brand" },
  { value: "INNOVATION", label: "Innovation" },
  { value: "TIME_TO_VALUE", label: "Time to Value" },
  { value: "INTEGRATION", label: "Integration" },
];

const DECISION_STYLES = [
  { value: "", label: "Select..." },
  { value: "ANALYTICAL", label: "Analytical" },
  { value: "INTUITIVE", label: "Intuitive" },
  { value: "CONSENSUS", label: "Consensus" },
  { value: "AUTHORITATIVE", label: "Authoritative" },
];

const RISK_TOLERANCES = [
  { value: "", label: "Select..." },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

function parseSafe<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[140px] shrink-0 text-xs text-[var(--text-muted)]">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)] h-1.5"
      />
      <span className="w-6 text-right text-xs font-semibold text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 mt-4 first:mt-0">
      {children}
    </h4>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const SELECT_CLASS = INPUT_CLASS + " appearance-none";

export function ICPTemplateForm({
  editData,
  onSuccess,
  onCancel,
}: ICPTemplateFormProps) {
  const isEdit = !!editData;
  const defaultBigFive = parseSafe(editData?.bigFiveProfile, {
    openness: 5,
    conscientiousness: 5,
    extraversion: 5,
    agreeableness: 5,
    neuroticism: 5,
  });
  const defaultMotivation = parseSafe(editData?.motivationProfile, {
    autonomy: 50,
    competence: 50,
    relatedness: 50,
  });
  const defaultDrivers = parseSafe<string[]>(editData?.valueDrivers, []);

  const [form, setForm] = useState<ICPFormData>({
    name: editData?.name ?? "",
    bigFiveProfile: defaultBigFive,
    motivationProfile: defaultMotivation,
    decisionStyle: editData?.decisionStyle ?? "",
    riskTolerance: editData?.riskTolerance ?? "",
    valueDrivers: defaultDrivers,
    idealIndustries: editData?.idealIndustries ?? "",
    idealCompanySizeMin: editData?.idealCompanySizeMin ?? null,
    idealCompanySizeMax: editData?.idealCompanySizeMax ?? null,
    idealAnnualRevenueMinBRL: editData?.idealAnnualRevenueMinBRL ?? null,
    idealAnnualRevenueMaxBRL: editData?.idealAnnualRevenueMaxBRL ?? null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBigFive = useCallback(
    (key: keyof ICPFormData["bigFiveProfile"], value: number) => {
      setForm((prev) => ({
        ...prev,
        bigFiveProfile: { ...prev.bigFiveProfile, [key]: value },
      }));
    },
    []
  );

  const updateMotivation = useCallback(
    (key: keyof ICPFormData["motivationProfile"], value: number) => {
      setForm((prev) => ({
        ...prev,
        motivationProfile: { ...prev.motivationProfile, [key]: value },
      }));
    },
    []
  );

  const toggleDriver = useCallback((driver: string) => {
    setForm((prev) => ({
      ...prev,
      valueDrivers: prev.valueDrivers.includes(driver)
        ? prev.valueDrivers.filter((d) => d !== driver)
        : [...prev.valueDrivers, driver],
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.name.trim()) {
        setError("Name is required");
        return;
      }

      setSubmitting(true);
      setError(null);

      const payload = {
        name: form.name.trim(),
        bigFiveProfile: JSON.stringify(form.bigFiveProfile),
        motivationProfile: JSON.stringify(form.motivationProfile),
        decisionStyle: form.decisionStyle || undefined,
        riskTolerance: form.riskTolerance || undefined,
        valueDrivers:
          form.valueDrivers.length > 0
            ? JSON.stringify(form.valueDrivers)
            : undefined,
        idealIndustries: form.idealIndustries || undefined,
        idealCompanySizeMin: form.idealCompanySizeMin ?? undefined,
        idealCompanySizeMax: form.idealCompanySizeMax ?? undefined,
        idealAnnualRevenueMinBRL: form.idealAnnualRevenueMinBRL ?? undefined,
        idealAnnualRevenueMaxBRL: form.idealAnnualRevenueMaxBRL ?? undefined,
      };

      try {
        const result = isEdit
          ? await apiPut(`/api/icp/${editData!.id}`, payload)
          : await apiPost("/api/icp", payload);

        if (result.error) {
          setError(result.error);
        } else {
          onSuccess?.();
        }
      } catch {
        setError("Error saving ICP");
      } finally {
        setSubmitting(false);
      }
    },
    [form, isEdit, editData, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nome */}
      <GlassCard className="p-4">
        <SectionTitle>Name & Description</SectionTitle>
        <input
          type="text"
          placeholder="ICP profile name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className={INPUT_CLASS}
        />
      </GlassCard>

      {/* Big Five */}
      <GlassCard className="p-4">
        <SectionTitle>Big Five — Target (0-10)</SectionTitle>
        <div className="space-y-2">
          <SliderField label="Openness" value={form.bigFiveProfile.openness} onChange={(v) => updateBigFive("openness", v)} />
          <SliderField label="Conscientiousness" value={form.bigFiveProfile.conscientiousness} onChange={(v) => updateBigFive("conscientiousness", v)} />
          <SliderField label="Extraversion" value={form.bigFiveProfile.extraversion} onChange={(v) => updateBigFive("extraversion", v)} />
          <SliderField label="Agreeableness" value={form.bigFiveProfile.agreeableness} onChange={(v) => updateBigFive("agreeableness", v)} />
          <SliderField label="Neuroticism" value={form.bigFiveProfile.neuroticism} onChange={(v) => updateBigFive("neuroticism", v)} />
        </div>
      </GlassCard>

      {/* Motivation */}
      <GlassCard className="p-4">
        <SectionTitle>Motivation Profile (0-100)</SectionTitle>
        <div className="space-y-2">
          <SliderField label="Autonomy" value={form.motivationProfile.autonomy} onChange={(v) => updateMotivation("autonomy", v)} min={0} max={100} />
          <SliderField label="Competence" value={form.motivationProfile.competence} onChange={(v) => updateMotivation("competence", v)} min={0} max={100} />
          <SliderField label="Relatedness" value={form.motivationProfile.relatedness} onChange={(v) => updateMotivation("relatedness", v)} min={0} max={100} />
        </div>
      </GlassCard>

      {/* Decision Style & Risk */}
      <GlassCard className="p-4">
        <SectionTitle>Decision Style</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Decision style
            </label>
            <select
              value={form.decisionStyle}
              onChange={(e) => setForm((prev) => ({ ...prev, decisionStyle: e.target.value }))}
              className={SELECT_CLASS}
            >
              {DECISION_STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Risk tolerance
            </label>
            <select
              value={form.riskTolerance}
              onChange={(e) => setForm((prev) => ({ ...prev, riskTolerance: e.target.value }))}
              className={SELECT_CLASS}
            >
              {RISK_TOLERANCES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Value Drivers */}
      <GlassCard className="p-4">
        <SectionTitle>Value Drivers</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {VALUE_DRIVER_OPTIONS.map((d) => {
            const active = form.valueDrivers.includes(d.value);
            return (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDriver(d.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Firmographic */}
      <GlassCard className="p-4">
        <SectionTitle>Firmographics</SectionTitle>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Industries (comma-separated)
            </label>
            <input
              type="text"
              placeholder="Technology, Finance, Healthcare"
              value={form.idealIndustries}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, idealIndustries: e.target.value }))
              }
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Min. size (employees)
              </label>
              <input
                type="number"
                placeholder="10"
                value={form.idealCompanySizeMin ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    idealCompanySizeMin: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Max. size
              </label>
              <input
                type="number"
                placeholder="500"
                value={form.idealCompanySizeMax ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    idealCompanySizeMax: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Min. annual revenue (USD)
              </label>
              <input
                type="number"
                placeholder="1000000"
                value={form.idealAnnualRevenueMinBRL ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    idealAnnualRevenueMinBRL: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Max. annual revenue
              </label>
              <input
                type="number"
                placeholder="50000000"
                value={form.idealAnnualRevenueMaxBRL ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    idealAnnualRevenueMaxBRL: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 px-1">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {submitting
            ? "Saving..."
            : isEdit
              ? "Update ICP"
              : "Create ICP"}
        </button>
      </div>
    </form>
  );
}
