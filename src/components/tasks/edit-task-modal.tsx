"use client";

import { useState, useEffect } from "react";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { apiPut, apiDelete } from "@/lib/hooks/use-api";

interface EditTaskModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  task: {
    id: string;
    title: string;
    description?: string;
    type: string;
    priority: string;
    status: string;
    dueDate?: string;
  } | null;
}

export function EditTaskModal({ open, onClose, onUpdated, task }: EditTaskModalProps) {
  const { toastSuccess, toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "FOLLOW_UP",
    priority: "MEDIUM",
    status: "PENDING",
    dueDate: "",
  });

  useEffect(() => {
    if (task && open) {
      setForm({
        title: task.title,
        description: task.description || "",
        type: task.type,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : "",
      });
      setErrors({});
    }
  }, [task, open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !validate()) return;

    setSubmitting(true);
    const payload: any = {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      priority: form.priority,
      status: form.status,
    };
    if (form.dueDate) {
      payload.dueDate = new Date(form.dueDate).toISOString();
    }

    const { error } = await apiPut(`/api/tasks/${task.id}`, payload);
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Task updated successfully");
    onUpdated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Task" description="Update task details">
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
            placeholder="Task description..."
            className={`${inputStyles} resize-none`}
          />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Type">
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className={selectStyles}>
              <option value="FOLLOW_UP">Follow Up</option>
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="REVIEW">Review</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={selectStyles}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className={selectStyles}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </FormField>
        </div>

        <FormField label="Due Date">
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
            className={inputStyles}
          />
        </FormField>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              if (!task || !confirm("Delete this task?")) return;
              setSubmitting(true);
              const { error } = await apiDelete(`/api/tasks/${task.id}`);
              setSubmitting(false);
              if (error) { toastError(error); return; }
              toastSuccess("Task deleted");
              onUpdated();
              onClose();
            }}
            className="rounded-lg border border-danger px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
          >
            Delete Task
          </button>
          <div className="flex gap-3">
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
        </div>
      </form>
    </Modal>
  );
}
