"use client";

import { useState } from "react";
import { GlassCard } from "@/components/design-system";
import { ActionApprovalCard, ActionProposal } from "@/components/ActionApprovalCard";
import { apiPost } from "@/lib/hooks/use-api";
import { cn } from "@/lib/utils";

interface DebriefResult {
  id: string;
  summary: string;
  proposals: ActionProposal[];
}

interface DebriefModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  onComplete?: () => void;
}

export function DebriefModal({ open, onClose, opportunityId, onComplete }: DebriefModalProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DebriefResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    setError(null);

    const { data, error: err } = await apiPost<DebriefResult>("/api/debriefs", {
      text: text.trim(),
      opportunityId,
    });

    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }

    if (data) {
      setResult(data);
    }
  }

  function handleClose() {
    setText("");
    setError(null);
    setResult(null);
    setSubmitting(false);
    onClose();
    if (result) {
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
            Debrief do Deal
          </h2>
          <button
            onClick={handleClose}
            className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--text-secondary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-[var(--space-lg)] py-[var(--space-md)]">
          {/* Input phase */}
          {!result && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-md)]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Conte o que aconteceu no deal..."
                rows={5}
                disabled={submitting}
                className={cn(
                  "w-full resize-none rounded-[var(--radius-sm)] border border-[var(--glass-border)]",
                  "bg-[var(--glass-bg)] px-[var(--space-md)] py-[var(--space-sm)]",
                  "text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)]",
                  "focus:outline-none focus:border-[var(--accent-gold)]/50",
                  "disabled:opacity-50"
                )}
              />

              {error && (
                <p className="text-xs text-[var(--accent-red)]">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className={cn(
                  "w-full rounded-[var(--radius-sm)] px-4 py-3 text-sm font-semibold transition-all",
                  "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]",
                  "hover:bg-[var(--accent-gold)]/25 active:scale-[0.99]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "min-h-[48px]"
                )}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-gold)] border-t-transparent" />
                    Processando com IA...
                  </span>
                ) : (
                  "Enviar Debrief"
                )}
              </button>
            </form>
          )}

          {/* Result phase */}
          {result && (
            <div className="flex flex-col gap-[var(--space-md)]">
              {/* AI Summary */}
              <GlassCard className="border-l-2 border-l-[var(--accent-gold)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-[var(--space-xs)]">
                  Resumo da IA
                </p>
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                  {result.summary}
                </p>
              </GlassCard>

              {/* Action Proposals */}
              {result.proposals.length > 0 && (
                <div className="flex flex-col gap-[var(--space-sm)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Propostas de Acao ({result.proposals.length})
                  </p>
                  {result.proposals.map((proposal) => (
                    <ActionApprovalCard
                      key={proposal.id}
                      proposal={proposal}
                      debriefId={result.id}
                    />
                  ))}
                </div>
              )}

              {result.proposals.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-[var(--space-md)]">
                  Nenhuma proposta de acao gerada.
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
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
