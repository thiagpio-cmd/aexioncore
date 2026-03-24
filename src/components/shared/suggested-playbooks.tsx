"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";

interface SuggestedPlaybooksProps {
  stage?: string;    // e.g., "NEW", "CONTACTED", "DISCOVERY", "PROPOSAL"
  entityType: "lead" | "opportunity";
  maxItems?: number;
}

export function SuggestedPlaybooks({ stage, entityType, maxItems = 3 }: SuggestedPlaybooksProps) {
  const { data: playbooks, loading } = useApi<any[]>("/api/playbooks");

  if (loading || !playbooks || playbooks.length === 0) return null;

  // Filter playbooks relevant to the current stage
  const relevant = playbooks.filter((pb) => {
    if (!stage) return true;
    const pbStage = (pb.stage || "").toUpperCase();
    const currentStage = stage.toUpperCase();
    // Match if playbook stage matches current stage, or is "ALL"
    return pbStage === currentStage || pbStage === "ALL" || !pb.stage;
  }).slice(0, maxItems);

  if (relevant.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Suggested Playbooks
      </h3>
      <div className="space-y-2">
        {relevant.map((pb) => (
          <Link
            key={pb.id}
            href={`/playbooks/${pb.id}`}
            className="block rounded-lg border border-border p-3 hover:bg-background/50 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-foreground">{pb.name}</p>
              <span className="text-xs text-success font-medium">{pb.conversionRate}%</span>
            </div>
            <p className="text-xs text-muted line-clamp-2">{pb.description}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-muted">{pb.steps?.length || 0} steps</span>
              <span className="text-[10px] text-muted">· {pb.segment || "General"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
