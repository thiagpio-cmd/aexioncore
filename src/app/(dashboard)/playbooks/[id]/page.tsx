"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { useApi } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { cn } from "@/lib/utils";

interface PlaybookStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  resources?: string;
}

interface Playbook {
  id: string;
  name: string;
  description?: string;
  segment?: string;
  stage?: string;
  conversionRate: number;
  usage: number;
  steps: PlaybookStep[];
  createdAt: string;
}

export default function PlaybookDetailPage() {
  const params = useParams();
  const playbookId = params.id as string;
  const { toastSuccess } = useToast();

  const { data: playbook, loading } = useApi<Playbook>(`/api/playbooks/${playbookId}`);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (loading) return <DetailSkeleton />;

  if (!playbook) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Playbook not found</p>
        <Link href="/playbooks" className="mt-2 text-primary text-sm hover:underline">Back to Playbooks</Link>
      </div>
    );
  }

  const totalSteps = playbook.steps.length;
  const doneCount = completedSteps.size;
  const progress = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  const toggleStep = (stepId: string) => {
    const next = new Set(completedSteps);
    if (next.has(stepId)) {
      next.delete(stepId);
    } else {
      next.add(stepId);
    }
    setCompletedSteps(next);
    if (next.has(stepId) && next.size === totalSteps) {
      toastSuccess("Playbook completed! All steps done.");
    }
  };

  return (
    <div>
      <Link
        href="/playbooks"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to Playbooks
      </Link>

      <PageHeader
        title={playbook.name}
        description={playbook.description || undefined}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <div className="h-2 w-24 rounded-full bg-background">
                <div
                  className={cn("h-2 rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted">{doneCount}/{totalSteps}</span>
            </div>
            {progress === 100 && (
              <span className="rounded-full bg-success-light px-3 py-1 text-xs font-medium text-success">Completed</span>
            )}
          </div>
        }
      />

      {/* Playbook Meta */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: "Segment", value: playbook.segment || "All" },
          { label: "Stage", value: playbook.stage || "All Stages" },
          { label: "Conversion Rate", value: `${playbook.conversionRate}%` },
          { label: "Usage", value: `${playbook.usage} times` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Steps with execution tracking */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Steps ({totalSteps})</h3>
          {doneCount > 0 && doneCount < totalSteps && (
            <button
              onClick={() => setCompletedSteps(new Set())}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Reset Progress
            </button>
          )}
        </div>

        {playbook.steps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No steps defined yet</p>
        ) : (
          <div className="space-y-0">
            {playbook.steps.map((step, i) => {
              const isDone = completedSteps.has(step.id);
              const isActive = activeStep === step.id;
              return (
                <div key={step.id} className="flex gap-4">
                  {/* Step indicator */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => toggleStep(step.id)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-all",
                        isDone
                          ? "bg-success text-white"
                          : "bg-primary-light text-primary hover:bg-primary hover:text-white"
                      )}
                    >
                      {isDone ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        step.order
                      )}
                    </button>
                    {i < playbook.steps.length - 1 && (
                      <div className={cn("w-px flex-1 my-1 transition-colors", isDone ? "bg-success" : "bg-border")} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 pb-4">
                    <div
                      className={cn(
                        "rounded-lg border px-4 py-3 cursor-pointer transition-all",
                        isDone ? "border-success/30 bg-success/5" : "border-border hover:border-primary/30",
                        isActive && "ring-1 ring-primary/30"
                      )}
                      onClick={() => setActiveStep(isActive ? null : step.id)}
                    >
                      <div className="flex items-center justify-between">
                        <p className={cn("text-sm font-medium", isDone ? "text-success line-through" : "text-foreground")}>
                          {step.title}
                        </p>
                        <div className="flex items-center gap-2">
                          {isDone && <span className="text-[10px] text-success font-medium">Done</span>}
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className={cn("text-muted transition-transform", isActive && "rotate-180")}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </div>

                      {isActive && (
                        <div className="mt-3 space-y-3">
                          {step.description && (
                            <p className="text-sm text-muted leading-relaxed">{step.description}</p>
                          )}
                          {step.resources && (
                            <div className="rounded-lg bg-primary-light px-3 py-2">
                              <p className="text-xs font-medium text-primary">Resources</p>
                              <p className="text-xs text-primary/80 mt-0.5">{step.resources}</p>
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-medium text-muted mb-1 block">Notes</label>
                            <textarea
                              value={notes[step.id] || ""}
                              onChange={(e) => setNotes({ ...notes, [step.id]: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Add notes for this step..."
                              rows={2}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }}
                              className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                isDone
                                  ? "border border-border text-muted hover:text-foreground"
                                  : "bg-success text-white hover:bg-success/90"
                              )}
                            >
                              {isDone ? "Undo" : "Mark Complete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
