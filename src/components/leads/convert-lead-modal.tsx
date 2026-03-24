"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPost } from "@/lib/hooks/use-api";

interface ConvertLeadModalProps {
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
  lead: {
    id: string;
    name: string;
    email: string;
    company?: { id: string; name: string };
  } | null;
}

const OPP_STAGES = [
  { value: "DISCOVERY", label: "Discovery" },
  { value: "QUALIFICATION", label: "Qualification" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
];

export function ConvertLeadModal({ open, onClose, onConverted, lead }: ConvertLeadModalProps) {
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    opportunityTitle: "",
    opportunityValue: 0,
    stage: "DISCOVERY",
    probability: 20,
    expectedCloseDate: "",
    description: "",
  });

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.opportunityTitle.trim()) e.opportunityTitle = "Title is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !validate()) return;

    setSubmitting(true);
    const payload: any = {
      opportunityTitle: form.opportunityTitle,
      opportunityValue: Number(form.opportunityValue),
      stage: form.stage,
      probability: Number(form.probability),
      description: form.description || undefined,
    };
    if (form.expectedCloseDate) {
      payload.expectedCloseDate = new Date(form.expectedCloseDate).toISOString();
    }

    const { data, error } = await apiPost(`/api/leads/${lead.id}/convert`, payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Lead converted to opportunity!");
    onConverted();
    onClose();

    // Navigate to the new opportunity
    if (data?.opportunity?.id) {
      router.push(`/opportunities/${data.opportunity.id}`);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert Lead to Opportunity"
      description={lead ? `Convert "${lead.name}" at ${lead.company?.name || "Unknown"} into a deal` : ""}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Opportunity Title" required error={errors.opportunityTitle}>
          <input
            type="text"
            value={form.opportunityTitle}
            onChange={(e) => set("opportunityTitle", e.target.value)}
            placeholder={lead ? `Deal with ${lead.company?.name || lead.name}` : ""}
            className={inputStyles}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Value ($)">
            <input
              type="number"
              value={form.opportunityValue}
              onChange={(e) => set("opportunityValue", Number(e.target.value))}
              min="0"
              step="100"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Stage">
            <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={selectStyles}>
              {OPP_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Expected Close Date">
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => set("expectedCloseDate", e.target.value)}
              className={inputStyles}
            />
          </FormField>
          <FormField label={`Probability: ${form.probability}%`}>
            <input
              type="range"
              min="0"
              max="100"
              value={form.probability}
              onChange={(e) => set("probability", Number(e.target.value))}
              className="w-full accent-primary mt-2"
            />
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="Optional deal notes..."
            className={`${inputStyles} resize-none`}
          />
        </FormField>

        <div className="rounded-lg border border-primary/20 bg-primary-light/30 p-3">
          <p className="text-xs text-foreground font-medium">What happens on conversion:</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted">
            <li>• Lead status changes to CONVERTED</li>
            <li>• Account is created (or linked if exists)</li>
            <li>• New opportunity is created with your settings</li>
            <li>• All actions are logged in the audit trail</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Converting..." : "Convert to Opportunity"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
