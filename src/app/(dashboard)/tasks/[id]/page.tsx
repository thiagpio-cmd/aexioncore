"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/shared/health-badge";
import { getInitials } from "@/lib/utils";
import { useApi, apiPut, apiDelete } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { EditTaskModal } from "@/components/tasks/edit-task-modal";
import { DetailSkeleton } from "@/components/shared/skeleton";

interface Task {
  id: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  leadId?: string;
  opportunityId?: string;
  opportunity?: { id: string; title: string; stage: string };
  ownerId: string;
  owner?: { id: string; name: string; email: string };
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"];

const priorityConfig: Record<string, { color: string; label: string }> = {
  HIGH: { color: "bg-danger-light text-danger", label: "High" },
  MEDIUM: { color: "bg-warning-light text-warning", label: "Medium" },
  LOW: { color: "bg-gray-100 text-gray-600", label: "Low" },
};

const typeIcons: Record<string, string> = {
  FOLLOW_UP: "🔄", CALL: "📞", EMAIL: "📧", MEETING: "📅", REVIEW: "📋", OTHER: "📝",
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const { toastSuccess, toastError } = useToast();
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const { data: task, loading, refetch } = useApi<Task>(`/api/tasks/${taskId}`);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Task not found</p>
        <Link href="/tasks" className="mt-2 text-primary text-sm hover:underline">Back to Tasks</Link>
      </div>
    );
  }

  const pr = priorityConfig[task.priority] || priorityConfig.MEDIUM;
  const isOverdue = task.status !== "COMPLETED" && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div>
      <Link href="/tasks" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6" /></svg>
        Back to Tasks
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-2xl">
            {typeIcons[task.type] || "📋"}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-bold ${task.status === "COMPLETED" ? "text-muted line-through" : "text-foreground"}`}>
                {task.title}
              </h1>
              <StatusBadge status={task.status} />
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pr.color}`}>{pr.label}</span>
            </div>
            {task.description && (
              <p className="mt-1 text-sm text-muted max-w-xl">{task.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={updating}
            onClick={async () => {
              const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
              setUpdating(true);
              const { error } = await apiPut(`/api/tasks/${taskId}`, { status: newStatus });
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess(newStatus === "COMPLETED" ? "Task completed" : "Task reopened");
              refetch();
            }}
            className="rounded-lg bg-success px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {updating ? "Updating..." : task.status === "COMPLETED" ? "Reopen" : "Mark Complete"}
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;
              setUpdating(true);
              const { error } = await apiDelete(`/api/tasks/${taskId}`);
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess("Task deleted");
              router.push("/tasks");
            }}
            className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
            disabled={updating}
          >
            Delete
          </button>
          <select
            value={task.status}
            disabled={updating}
            onChange={async (e) => {
              const newStatus = e.target.value;
              setUpdating(true);
              const { error } = await apiPut(`/api/tasks/${taskId}`, { status: newStatus });
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess(`Status changed to ${newStatus.replace(/_/g, " ")}`);
              refetch();
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors focus:border-primary"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Task Details</h3>
            {task.description ? (
              <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
            ) : (
              <p className="text-sm text-muted">No description provided</p>
            )}
          </div>

          {task.opportunity && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-base font-semibold text-foreground">Related Opportunity</h3>
              <Link
                href={`/pipeline/${task.opportunity.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-background"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-sm font-bold text-primary">
                  {getInitials(task.opportunity.title)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{task.opportunity.title}</p>
                  <p className="text-xs text-muted">Stage: {task.opportunity.stage}</p>
                </div>
              </Link>
            </div>
          )}

          {task.leadId && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-base font-semibold text-foreground">Related Lead</h3>
              <Link
                href={`/leads/${task.leadId}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Lead
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Task Information</h3>
            <dl className="space-y-3">
              {[
                { label: "Status", value: task.status.replace(/_/g, " ") },
                { label: "Priority", value: pr.label },
                { label: "Type", value: task.type.replace(/_/g, " ") },
                { label: "Owner", value: task.owner?.name || "Unassigned" },
                {
                  label: "Due Date",
                  value: task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "No date",
                },
                ...(task.completedAt
                  ? [{ label: "Completed", value: new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }]
                  : []),
                { label: "Created", value: new Date(task.createdAt).toLocaleDateString() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {isOverdue && (
            <div className="rounded-xl border border-danger bg-danger-light p-4">
              <p className="text-sm font-medium text-danger">Overdue</p>
              <p className="text-xs text-danger mt-1">
                Due {new Date(task.dueDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h3>
            <div className="space-y-2">
              <button
                disabled={updating}
                onClick={async () => {
                  const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
                  setUpdating(true);
                  const { error } = await apiPut(`/api/tasks/${taskId}`, { status: newStatus });
                  setUpdating(false);
                  if (error) { toastError(error); return; }
                  toastSuccess(newStatus === "COMPLETED" ? "Task completed" : "Task reopened");
                  refetch();
                }}
                className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-background disabled:opacity-50"
              >
                {task.status === "COMPLETED" ? "Reopen Task" : "Mark Complete"}
              </button>
              <button
                onClick={() => setShowEdit(true)}
                className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-background"
              >
                Edit Task
              </button>
            </div>
          </div>
        </div>
      </div>

      <EditTaskModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onUpdated={() => refetch()}
        task={task}
      />
    </div>
  );
}
