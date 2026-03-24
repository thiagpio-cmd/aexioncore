"use client";

import { useState, useEffect } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPut } from "@/lib/hooks/use-api";

interface EditOpportunityModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  opportunity: {
    id: string;
    title: string;
    description?: string;
    value: number;
    stage: string;
    probability: number;
    expectedCloseDate?: string;
  } | null;
}

export function EditOpportunityModal({ open, onClose, onUpdated, opportunity }: EditOpportunityModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    value: 0,
    probability: 50,
    expectedCloseDate: "",
  });

  useEffect(() => {
    if (opportunity && open) {
      setForm({
        title: opportunity.title,
        description: opportunity.description || "",
        value: opportunity.value,
        probability: opportunity.probability,
        expectedCloseDate: opportunity.expectedCloseDate
          ? new Date(opportunity.expectedCloseDate).toISOString().split("T")[0]
          : "",
      });
      setErrors({});
    }
  }, [opportunity, open]);

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (form.value < 0) e.value = "Value must be positive";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!opportunity || !validate()) return;

    setSubmitting(true);
    const payload: any = {
      title: form.title,
      description: form.description || undefined,
      value: Number(form.value),
      probability: Number(form.probability),
    };
    if (form.expectedCloseDate) {
      payload.expectedCloseDate = new Date(form.expectedCloseDate).toISOString();
    }

    const { error } = await apiPut(`/api/opportunities/${opportunity.id}`, payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Opportunity updated successfully");
    onUpdated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Opportunity" description="Update deal information">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" required error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputStyles}
          />
        </FormField>

        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            placeholder="Deal description..."
            className={`${inputStyles} resize-none`}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Value (R$)" error={errors.value}>
            <input
              type="number"
              value={form.value}
              onChange={(e) => set("value", Number(e.target.value))}
              min="0"
              step="100"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Expected Close Date">
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => set("expectedCloseDate", e.target.value)}
              className={inputStyles}
            />
          </FormField>
        </div>

        <FormField label={`Probability: ${form.probability}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={form.probability}
            onChange={(e) => set("probability", Number(e.target.value))}
            className="w-full accent-primary"
          />
        </FormField>

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
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
