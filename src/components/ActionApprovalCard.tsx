"use client";

import { useState } from "react";
import { GlassCard } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { apiPost } from "@/lib/hooks/use-api";

export interface ActionProposal {
  id: string;
  type: string;
  description: string;
  financialImpact?: number;
  priority: "high" | "medium" | "low";
}

interface ActionApprovalCardProps {
  proposal: ActionProposal;
  debriefId: string;
  onApproved?: (id: string) => void;
  onRejected?: (id: string) => void;
}

const typeIcons: Record<string, string> = {
  followup: "F",
  meeting: "M",
  discount: "D",
  escalation: "E",
  proposal: "P",
  task: "T",
};

const typeBadgeColors: Record<string, string> = {
  followup: "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]",
  meeting: "bg-[var(--accent-gold)]/20 text-[var(--accent-gold)]",
  discount: "bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]",
  escalation: "bg-[var(--accent-red)]/20 text-[var(--accent-red)]",
  proposal: "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]",
  task: "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]",
};

const priorityColors: Record<string, string> = {
  high: "text-[var(--accent-red)]",
  medium: "text-[var(--accent-gold)]",
  low: "text-[var(--text-muted)]",
};

const priorityLabels: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ActionApprovalCard({
  proposal,
  debriefId,
  onApproved,
  onRejected,
}: ActionApprovalCardProps) {
  const [status, setStatus] = useState<"idle" | "approving" | "rejecting" | "approved" | "rejected">("idle");
  const [error, setError] = useState<string | null>(null);

  const typeKey = proposal.type.toLowerCase();
  const icon = typeIcons[typeKey] ?? proposal.type.charAt(0).toUpperCase();
  const badgeColor = typeBadgeColors[typeKey] ?? "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]";

  async function handleApprove() {
    setStatus("approving");
    setError(null);
    const { error: err } = await apiPost(`/api/debriefs/${debriefId}/approve`, {
      proposalId: proposal.id,
    });
    if (err) {
      setError(err);
      setStatus("idle");
      return;
    }
    setStatus("approved");
    onApproved?.(proposal.id);
  }

  async function handleReject() {
    setStatus("rejecting");
    setError(null);
    const { error: err } = await apiPost(`/api/debriefs/${debriefId}/reject`, {
      proposalId: proposal.id,
    });
    if (err) {
      setError(err);
      setStatus("idle");
      return;
    }
    setStatus("rejected");
    onRejected?.(proposal.id);
  }

  const isResolved = status === "approved" || status === "rejected";
  const isLoading = status === "approving" || status === "rejecting";

  return (
    <GlassCard
      className={cn(
        "flex flex-col gap-[var(--space-sm)]",
        isResolved && "opacity-60"
      )}
    >
      {/* Header: type badge + priority */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            badgeColor
          )}
        >
          <span className="text-[10px] font-mono">{icon}</span>
          {proposal.type}
        </span>
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wide",
            priorityColors[proposal.priority]
          )}
        >
          {priorityLabels[proposal.priority] ?? proposal.priority}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">
        {proposal.description}
      </p>

      {/* Financial impact */}
      {proposal.financialImpact != null && proposal.financialImpact !== 0 && (
        <p className="text-xs text-[var(--text-secondary)]">
          Impacto financeiro:{" "}
          <span className="font-semibold text-[var(--accent-gold)]">
            {formatBRL(proposal.financialImpact)}
          </span>
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-[var(--accent-red)]">{error}</p>
      )}

      {/* Status resolved */}
      {isResolved && (
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          {status === "approved" ? "Aprovada" : "Rejeitada"}
        </p>
      )}

      {/* Action buttons */}
      {!isResolved && (
        <div className="flex gap-[var(--space-sm)] pt-[var(--space-xs)]">
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className={cn(
              "flex-1 rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-semibold transition-all",
              "bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]",
              "hover:bg-[var(--accent-emerald)]/25 active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[44px]"
            )}
          >
            {status === "approving" ? "Aprovando..." : "Aprovar"}
          </button>
          <button
            onClick={handleReject}
            disabled={isLoading}
            className={cn(
              "flex-1 rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-semibold transition-all",
              "bg-[var(--accent-red)]/15 text-[var(--accent-red)]",
              "hover:bg-[var(--accent-red)]/25 active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[44px]"
            )}
          >
            {status === "rejecting" ? "Rejeitando..." : "Rejeitar"}
          </button>
        </div>
      )}
    </GlassCard>
  );
}
