"use client";

import { useState, useEffect } from "react";
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
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    value: "",
    stage: "LEAD_INQUIRY",
    accountId: "",
    ownerId: currentUserId || "",
    probability: "20",
    expectedCloseDate: "",
  });

  useEffect(() => {
    if (!open) return;

    setLoadingUsers(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setUsers(json.data.map((u: any) => ({ id: u.id, name: u.name })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));

    setLoadingAccounts(true);
    fetch("/api/accounts?limit=100")
      .then((res) => res.json())
      .then((json) => {
        const list = json.success ? json.data : Array.isArray(json) ? json : [];
        setAccounts(list.map((a: any) => ({ id: a.id, name: a.name })));
      })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, [open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.accountId.trim()) e.accountId = "Account is required";
    if (!form.ownerId.trim()) e.ownerId = "Owner is required";
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
      title: "", description: "", value: "", stage: "LEAD_INQUIRY",
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
            placeholder="Waterfront Mixed-Use Development"
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
              placeholder="5000000"
              min="0"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Stage">
            <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={selectStyles}>
              <option value="LEAD_INQUIRY">Lead Inquiry</option>
              <option value="PROPERTY_TOUR">Property Tour</option>
              <option value="OFFER_SUBMITTED">Offer Submitted</option>
              <option value="UNDER_CONTRACT">Under Contract</option>
              <option value="DUE_DILIGENCE">Due Diligence</option>
              <option value="CLOSED_WON">Closed Won</option>
              <option value="CLOSED_LOST">Closed Lost</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Account" required error={errors.accountId}>
            <select
              value={form.accountId}
              onChange={(e) => set("accountId", e.target.value)}
              className={selectStyles}
              disabled={loadingAccounts}
            >
              <option value="">
                {loadingAccounts ? "Loading..." : "Select account"}
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Owner" required error={errors.ownerId}>
            <select
              value={form.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
              className={selectStyles}
              disabled={loadingUsers}
            >
              <option value="">
                {loadingUsers ? "Loading..." : "Select owner"}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
