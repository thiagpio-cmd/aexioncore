"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/design-system";
import { ActionApprovalCard, ActionProposal } from "@/components/ActionApprovalCard";
import { DebriefInput } from "@/components/debrief/DebriefInput";
import { cn } from "@/lib/utils";

interface DebriefResult {
  id: string;
  summary: string;
  proposals: Array<{
    id: string;
    actionType: string;
    description: string;
    urgency: string;
    financialImpact: string | null;
    status: string;
    params: Record<string, unknown>;
  }>;
}

interface OpportunityOption {
  id: string;
  title: string;
  account: string;
  stage: string;
}

interface DebriefModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  onComplete?: () => void;
}

function OpportunityPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/opportunities?limit=50&sortBy=updatedAt&sortOrder=desc")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.records) {
          setOpportunities(
            json.data.records.map((o: any) => ({
              id: o.id,
              title: o.title,
              account: o.account?.name || "—",
              stage: o.stage,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? opportunities.filter(
        (o) =>
          o.title.toLowerCase().includes(search.toLowerCase()) ||
          o.account.toLowerCase().includes(search.toLowerCase())
      )
    : opportunities;

  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      <p className="text-sm text-[var(--text-secondary)]">
        Select an opportunity to debrief:
      </p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search deals..."
        className={cn(
          "w-full rounded-[var(--radius-sm)] border border-[var(--glass-border)]",
          "bg-[var(--glass-bg)] px-[var(--space-md)] py-[var(--space-sm)]",
          "text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)]",
          "focus:outline-none focus:border-[var(--accent-gold)]/50"
        )}
      />
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">
          No opportunities found.
        </p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
          {filtered.map((opp) => (
            <button
              key={opp.id}
              type="button"
              onClick={() => onSelect(opp.id)}
              className={cn(
                "w-full text-left rounded-[var(--radius-sm)] px-3 py-2.5 transition-colors",
                "border border-transparent hover:border-[var(--accent)]/30",
                "hover:bg-[var(--accent)]/5"
              )}
            >
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {opp.title}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {opp.account} · {opp.stage.replace(/_/g, " ")}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DebriefModal({ open, onClose, opportunityId, onComplete }: DebriefModalProps) {
  const [result, setResult] = useState<DebriefResult | null>(null);
  const [selectedOppId, setSelectedOppId] = useState(opportunityId);

  // Sync when prop changes (e.g. opening from opportunity detail)
  useEffect(() => {
    setSelectedOppId(opportunityId);
  }, [opportunityId]);

  const activeOppId = selectedOppId || opportunityId;

  function handleResult(r: DebriefResult) {
    setResult(r);
  }

  function handleClose() {
    const hadResult = !!result;
    setResult(null);
    setSelectedOppId("");
    onClose();
    if (hadResult) {
      onComplete?.();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto",
          "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
          "bg-[var(--surface-elevated)] shadow-2xl shadow-black/40"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-[var(--space-lg)] py-[var(--space-md)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Deal Debrief
          </h2>
          <button
            onClick={handleClose}
            className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-secondary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-[var(--space-lg)] py-[var(--space-md)]">
          {/* Opportunity picker — shown when no opportunityId provided */}
          {!activeOppId && !result && (
            <OpportunityPicker onSelect={(id) => setSelectedOppId(id)} />
          )}

          {/* Input phase — shown once opportunity is selected */}
          {activeOppId && !result && (
            <DebriefInput
              opportunityId={activeOppId}
              onResult={handleResult}
            />
          )}

          {/* Result phase */}
          {result && (
            <div className="flex flex-col gap-[var(--space-md)]">
              {/* AI Summary */}
              <GlassCard className="border-l-2 border-l-[var(--accent-gold)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-[var(--space-xs)]">
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                  {result.summary}
                </p>
              </GlassCard>

              {/* Action Proposals */}
              {result.proposals.length > 0 && (
                <div className="flex flex-col gap-[var(--space-sm)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Action Proposals ({result.proposals.length})
                  </p>
                  {result.proposals.map((proposal) => (
                    <ActionApprovalCard
                      key={proposal.id}
                      proposal={{
                        id: proposal.id,
                        type: proposal.actionType,
                        description: proposal.description,
                        priority: mapUrgencyToPriority(proposal.urgency),
                        financialImpact: parseFinancialImpact(proposal.financialImpact),
                      }}
                      debriefId={result.id}
                    />
                  ))}
                </div>
              )}

              {result.proposals.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-[var(--space-md)]">
                  No action proposals generated.
                </p>
              )}

              {/* Done button */}
              <button
                onClick={handleClose}
                className={cn(
                  "w-full rounded-[var(--radius-sm)] px-4 py-3 text-sm font-semibold transition-all",
                  "bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]",
                  "hover:bg-[var(--accent-emerald)]/25 active:scale-[0.99]",
                  "min-h-[48px]"
                )}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function mapUrgencyToPriority(urgency: string): "high" | "medium" | "low" {
  switch (urgency) {
    case "immediate":
      return "high";
    case "today":
      return "medium";
    case "this_week":
    default:
      return "low";
  }
}

function parseFinancialImpact(impact: string | null): number | undefined {
  if (!impact) return undefined;
  const match = impact.replace(/\./g, "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
