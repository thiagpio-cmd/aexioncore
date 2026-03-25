"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Modal, FormField, inputStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { useApi, apiPost } from "@/lib/hooks/use-api";

type Stage = { id: string; name: string; order: number; color: string | null };
type Pipeline = {
  id: string;
  name: string;
  description: string | null;
  stages: Stage[];
  createdAt: string;
};

export default function SettingsPipelinesPage() {
  const { toastSuccess, toastError } = useToast();
  const { data: pipelines, loading, refetch } = useApi<Pipeline[]>("/api/pipelines");
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toastError("Pipeline name is required");
      return;
    }

    setSubmitting(true);
    const { error } = await apiPost("/api/pipelines", {
      name: form.name,
      description: form.description || undefined,
      defaultStages: true,
    });
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Pipeline created successfully");
    setShowCreate(false);
    setForm({ name: "", description: "" });
    refetch();
  }

  const pipelineList = pipelines || [];

  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Settings
      </Link>
      <PageHeader
        title="Pipelines"
        description="Configure deal stages and workflows"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            + New Pipeline
          </button>
        }
      />

      {loading && (
        <div className="mt-4 flex items-center justify-center py-20">
          <div className="text-sm text-muted">Loading pipelines...</div>
        </div>
      )}

      {!loading && pipelineList.length === 0 && (
        <div className="mt-4 flex flex-col items-center justify-center py-20 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted/40 mb-3">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p className="text-sm font-medium text-foreground">No pipelines yet</p>
          <p className="mt-1 text-xs text-muted">Create your first pipeline to get started with deal stages.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            + New Pipeline
          </button>
        </div>
      )}

      {!loading && pipelineList.length > 0 && (
        <div className="mt-4 space-y-4">
          {pipelineList.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted mt-0.5">{p.description}</p>
                  )}
                </div>
                <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted">
                  {p.stages.length} stages
                </span>
              </div>
              {p.stages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.stages.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        backgroundColor: s.color ? `${s.color}18` : undefined,
                        color: s.color || undefined,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Pipeline"
        description="Add a new deal pipeline with default stages"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Pipeline Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Enterprise Sales"
              className={inputStyles}
              autoFocus
            />
          </FormField>
          <FormField label="Description">
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Pipeline for enterprise deals"
              className={inputStyles}
            />
          </FormField>
          <p className="text-xs text-muted">
            Default stages (Discovery, Qualification, Proposal, Negotiation, Closed Won, Closed Lost) will be created automatically.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Pipeline"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
