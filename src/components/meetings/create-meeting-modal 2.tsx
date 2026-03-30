"use client";

import { useState } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPost } from "@/lib/hooks/use-api";

interface CreateMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUserId?: string;
}

const TYPE_OPTIONS = [
  { value: "DISCOVERY", label: "Discovery" },
  { value: "DEMO", label: "Demo" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "INTERNAL", label: "Internal" },
];

export function CreateMeetingModal({ open, onClose, onCreated, currentUserId }: CreateMeetingModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "DISCOVERY",
    startTime: "",
    endTime: "",
    location: "",
    attendees: "",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.startTime) e.startTime = "Start time is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const payload: any = {
      title: form.title,
      startTime: new Date(form.startTime).toISOString(),
      ownerId: currentUserId || "",
    };
    if (form.description) payload.description = form.description;
    if (form.endTime) payload.endTime = new Date(form.endTime).toISOString();
    if (form.location) payload.location = form.location;
    if (form.attendees) payload.attendees = form.attendees;
    if (form.notes) payload.notes = form.notes;

    const { error } = await apiPost("/api/meetings", payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Meeting created successfully");
    onCreated();
    onClose();
    setForm({
      title: "", description: "", type: "DISCOVERY",
      startTime: "", endTime: "", location: "", attendees: "", notes: "",
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="New Meeting" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" required error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Discovery call with Acme Corp"
            className={inputStyles}
          />
        </FormField>

        <FormField label="Type">
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className={selectStyles}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Time" required error={errors.startTime}>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className={inputStyles}
            />
          </FormField>

          <FormField label="End Time">
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              className={inputStyles}
            />
          </FormField>
        </div>

        <FormField label="Location">
          <input
            type="text"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. https://meet.google.com/... or Office Room 3B"
            className={inputStyles}
          />
        </FormField>

        <FormField label="Attendees">
          <input
            type="text"
            value={form.attendees}
            onChange={(e) => set("attendees", e.target.value)}
            placeholder="e.g. Sarah Chen, John Doe"
            className={inputStyles}
          />
        </FormField>

        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Meeting agenda or description..."
            rows={3}
            className={`${inputStyles} resize-none`}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Meeting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
