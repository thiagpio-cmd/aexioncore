"use client";

import { useState } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPost } from "@/lib/hooks/use-api";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUserId?: string;
  /** Pre-fill relationships */
  leadId?: string;
  opportunityId?: string;
}

export function CreateTaskModal({ open, onClose, onCreated, currentUserId, leadId, opportunityId }: CreateTaskModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "FOLLOW_UP",
    priority: "MEDIUM",
    ownerId: currentUserId || "",
    leadId: leadId || "",
    opportunityId: opportunityId || "",
    dueDate: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
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
      type: form.type,
      priority: form.priority,
      ownerId: form.ownerId,
    };
    if (form.leadId) payload.leadId = form.leadId;
    if (form.opportunityId) payload.opportunityId = form.opportunityId;
    if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();

    const { error } = await apiPost("/api/tasks", payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Task created successfully");
    onCreated();
    onClose();
    setForm({
      title: "", description: "", type: "FOLLOW_UP", priority: "MEDIUM",
      ownerId: currentUserId || "", leadId: leadId || "", opportunityId: opportunityId || "", dueDate: "",
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Task" description="Add a new task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" required error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Follow up with client"
            className={inputStyles}
          />
        </FormField>

        <FormField label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Task details..."
            rows={3}
            className={inputStyles}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className={selectStyles}>
              <option value="FOLLOW_UP">Follow Up</option>
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="APPROVAL">Approval</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={selectStyles}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Due Date">
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
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
            {submitting ? "Creating..." : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
