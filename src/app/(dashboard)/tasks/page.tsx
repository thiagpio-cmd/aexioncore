"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useApi, apiPut } from "@/lib/hooks/use-api";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { EditTaskModal } from "@/components/tasks/edit-task-modal";
import { useToast } from "@/components/shared/toast";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/shared/skeleton";

const statusTabs = [
  { key: "all", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

const priorityConfig: Record<string, { color: string; label: string }> = {
  HIGH: { color: "bg-danger-light text-danger", label: "High" },
  MEDIUM: { color: "bg-warning-light text-warning", label: "Medium" },
  LOW: { color: "bg-gray-100 text-gray-600", label: "Low" },
};

const typeIcons: Record<string, string> = {
  FOLLOW_UP: "🔄", CALL: "📞", EMAIL: "📧", MEETING: "📅", REVIEW: "📋", OTHER: "📝",
};

export default function TasksPage() {
  const { data: session } = useSession();
  const { toastSuccess, toastError } = useToast();
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const { data: tasks, loading, refetch } = useApi<any[]>("/api/tasks?limit=50");

  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (filter === "all") return tasks;
    return tasks.filter((t: any) => t.status === filter);
  }, [tasks, filter]);

  const pendingCount = tasks?.filter((t: any) => t.status === "PENDING").length ?? 0;
  const inProgressCount = tasks?.filter((t: any) => t.status === "IN_PROGRESS").length ?? 0;

  const isOverdue = (task: any) => {
    if (task.status === "COMPLETED") return false;
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date();
  };

  const overdueCount = tasks?.filter(isOverdue).length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        subtitle={`${overdueCount} overdue · ${inProgressCount} in progress · ${pendingCount} pending`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            + New Task
          </button>
        }
      />

      <div className="flex gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-primary text-white"
                : "bg-surface border border-border text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((task: any) => {
              const pr = priorityConfig[task.priority] || priorityConfig.MEDIUM;
              const overdue = isOverdue(task);
              return (
                <div key={task.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/50 transition-colors">
                  <button
                    onClick={async () => {
                      const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
                      const { error } = await apiPut(`/api/tasks/${task.id}`, { status: newStatus });
                      if (error) { toastError(error); return; }
                      toastSuccess(newStatus === "COMPLETED" ? "Task completed" : "Task reopened");
                      refetch();
                    }}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      task.status === "COMPLETED"
                        ? "bg-success border-success text-white"
                        : "border-border text-transparent hover:border-muted"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <span className="text-base">{typeIcons[task.type] || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "COMPLETED" ? "text-muted line-through" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {task.owner?.name || ""} · {task.description || ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pr.color}`}>{pr.label}</span>
                  <span className={`text-xs font-medium ${overdue ? "text-danger" : "text-muted"}`}>
                    {overdue
                      ? "Overdue"
                      : task.status === "COMPLETED"
                        ? "Done"
                        : task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })
                          : "No date"}
                  </span>
                  <button
                    onClick={() => setEditingTask(task)}
                    className="rounded-md p-1 text-muted hover:text-foreground transition-colors"
                    title="Edit task"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-muted">No tasks found</div>
            )}
          </div>
        )}
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetch()}
        currentUserId={session?.user?.id}
      />

      <EditTaskModal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onUpdated={() => refetch()}
        task={editingTask}
      />
    </div>
  );
}
