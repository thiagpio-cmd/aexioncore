"use client";

import { useState, useEffect } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPut } from "@/lib/hooks/use-api";

interface EditLeadModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  lead: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    title?: string;
    source: string;
    status: string;
    temperature: string;
    fitScore: number;
  } | null;
}

export function EditLeadModal({ open, onClose, onUpdated, lead }: EditLeadModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
    source: "web",
    temperature: "COLD",
    fitScore: 50,
  });

  useEffect(() => {
    if (lead && open) {
      setForm({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || "",
        title: lead.title || "",
        source: lead.source,
        temperature: lead.temperature,
        fitScore: lead.fitScore,
      });
      setErrors({});
    }
  }, [lead, open]);

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !validate()) return;

    setSubmitting(true);
    const { error } = await apiPut(`/api/leads/${lead.id}`, {
      ...form,
      fitScore: Number(form.fitScore),
    });
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Lead updated successfully");
    onUpdated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Lead" description="Update lead information">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputStyles}
            />
          </FormField>
          <FormField label="Email" required error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputStyles}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputStyles}
            />
          </FormField>
          <FormField label="Title">
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="VP of Sales"
              className={inputStyles}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Source">
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className={selectStyles}>
              <option value="web">Web</option>
              <option value="linkedin">LinkedIn</option>
              <option value="referral">Referral</option>
              <option value="outbound">Outbound</option>
              <option value="event">Event</option>
              <option value="partner">Partner</option>
            </select>
          </FormField>
          <FormField label="Temperature">
            <select value={form.temperature} onChange={(e) => set("temperature", e.target.value)} className={selectStyles}>
              <option value="COLD">Cold</option>
              <option value="COOL">Cool</option>
              <option value="WARM">Warm</option>
              <option value="HOT">Hot</option>
            </select>
          </FormField>
        </div>

        <FormField label={`Fit Score: ${form.fitScore}`}>
          <input
            type="range"
            min="0"
            max="100"
            value={form.fitScore}
            onChange={(e) => set("fitScore", Number(e.target.value))}
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
