"use client";

import { useState } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPost } from "@/lib/hooks/use-api";

interface LogActivityModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-selected activity type */
  defaultType?: string;
  /** Link to lead */
  leadId?: string;
  /** Link to opportunity */
  opportunityId?: string;
}

const ACTIVITY_TYPES = [
  { value: "CALL", label: "Log Call" },
  { value: "EMAIL", label: "Email" },
  { value: "NOTE", label: "Note" },
  { value: "MEETING", label: "Meeting" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

const CHANNEL_OPTIONS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "in_person", label: "In Person" },
  { value: "system", label: "System" },
];

export function LogActivityModal({
  open,
  onClose,
  onCreated,
  defaultType = "NOTE",
  leadId,
  opportunityId,
}: LogActivityModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    type: defaultType,
    channel: "phone",
    subject: "",
    body: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function resetForm() {
    setForm({ type: defaultType, channel: "phone", subject: "", body: "" });
    setErrors({});
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.subject.trim()) e.subject = "Subject is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const payload: any = {
      type: form.type,
      channel: form.channel,
      subject: form.subject,
      body: form.body || undefined,
    };
    if (leadId) payload.leadId = leadId;
    if (opportunityId) payload.opportunityId = opportunityId;

    const { error } = await apiPost("/api/activities", payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Activity logged successfully");
    onCreated();
    onClose();
    resetForm();
  }

  // Update default channel based on type
  function handleTypeChange(type: string) {
    const channelMap: Record<string, string> = {
      CALL: "phone",
      EMAIL: "email",
      NOTE: "system",
      MEETING: "in_person",
      WHATSAPP: "whatsapp",
    };
    setForm((prev) => ({
      ...prev,
      type,
      channel: channelMap[type] || prev.channel,
    }));
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Activity" description="Record a new interaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={selectStyles}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Channel">
            <select
              value={form.channel}
              onChange={(e) => set("channel", e.target.value)}
              className={selectStyles}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Subject" required error={errors.subject}>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder={
              form.type === "CALL"
                ? "e.g. Discovery call with prospect"
                : form.type === "EMAIL"
                  ? "e.g. Sent proposal follow-up"
                  : form.type === "NOTE"
                    ? "e.g. Internal note about deal"
                    : "Subject..."
            }
            className={inputStyles}
          />
        </FormField>

        <FormField label="Details">
          <textarea
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            rows={4}
            placeholder="Add details about this interaction..."
            className={`${inputStyles} resize-none`}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => { onClose(); resetForm(); }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Log Activity"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
