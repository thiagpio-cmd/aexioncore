"use client";

import { useState } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPost } from "@/lib/hooks/use-api";

interface CreateOpportunityModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUserId?: string;
}

export function CreateOpportunityModal({ open, onClose, onCreated, currentUserId }: CreateOpportunityModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    value: "",
    stage: "discovery",
    accountId: "",
    ownerId: currentUserId || "",
    probability: "20",
    expectedCloseDate: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.accountId.trim()) e.accountId = "Account ID is required";
    if (!form.ownerId.trim()) e.ownerId = "Owner ID is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const payload: any = {
      title: form.title,
      description: form.description || undefined,
      value: Number(form.value) || 0,
      stage: form.stage,
      accountId: form.accountId,
      ownerId: form.ownerId,
      probability: Number(form.probability) || 0,
    };
    if (form.expectedCloseDate) payload.expectedCloseDate = new Date(form.expectedCloseDate).toISOString();

    const { error } = await apiPost("/api/opportunities", payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Opportunity created successfully");
    onCreated();
    onClose();
    setForm({
      title: "", description: "", value: "", stage: "discovery",
      accountId: "", ownerId: currentUserId || "", probability: "20", expectedCloseDate: "",
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Opportunity" description="Add a new deal to your pipeline">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" required error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Enterprise License Deal"
            className={inputStyles}
          />
        </FormField>

        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Deal details..."
            rows={2}
            className={inputStyles}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Value ($)">
            <input
              type="number"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              placeholder="50000"
              min="0"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Stage">
            <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={selectStyles}>
              <option value="discovery">Discovery</option>
              <option value="qualification">Qualification</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="closing">Closing</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Account ID" required error={errors.accountId}>
            <input
              type="text"
              value={form.accountId}
              onChange={(e) => set("accountId", e.target.value)}
              placeholder="Account ID"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Owner ID" required error={errors.ownerId}>
            <input
              type="text"
              value={form.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
              placeholder="Owner ID"
              className={inputStyles}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Probability: ${form.probability}%`}>
            <input
              type="range"
              min="0"
              max="100"
              value={form.probability}
              onChange={(e) => set("probability", e.target.value)}
              className="w-full accent-primary"
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
            {submitting ? "Creating..." : "Create Opportunity"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
