"use client";

import { GlassCard, MetricValue, StatusDot, SectionLabel } from "@/components/design-system";
import { useApi } from "@/lib/hooks/use-api";
import { cn } from "@/lib/utils";

interface ScoresData {
  riskScore: number;
  intentScore: number;
  momentumScore: number;
  moneyAtRisk: number;
  commissionAtRisk: number;
  delayCost: number;
  tone: "pressure" | "control" | "champion" | string;
  nextAction?: string;
}

interface DealRiskPanelProps {
  opportunityId: string;
  data?: ScoresData;
}

type RiskStatus = "success" | "danger" | "warning";

function scoreToStatus(score: number): RiskStatus {
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}

function riskToStatus(score: number): RiskStatus {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

const toneLabels: Record<string, { label: string; color: string }> = {
  pressure: { label: "Pressao", color: "text-[var(--accent-red)]" },
  control: { label: "Controle", color: "text-[var(--accent-emerald)]" },
  champion: { label: "Champion", color: "text-[var(--accent-gold)]" },
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function SkeletonBlock() {
  return (
    <GlassCard className="flex flex-col gap-[var(--space-md)]">
      <div className="h-3 w-24 rounded bg-[var(--glass-border)] animate-pulse" />
      <div className="flex flex-col gap-[var(--space-sm)]">
        <div className="h-5 w-32 rounded bg-[var(--glass-border)] animate-pulse" />
        <div className="h-5 w-28 rounded bg-[var(--glass-border)] animate-pulse" />
        <div className="h-5 w-36 rounded bg-[var(--glass-border)] animate-pulse" />
      </div>
    </GlassCard>
  );
}

function ScoreRow({ label, score, statusFn }: { label: string; score: number; statusFn: (s: number) => RiskStatus }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-[var(--space-sm)]">
        <StatusDot status={statusFn(score)} size="md" pulse={score >= 70 && statusFn === riskToStatus} />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className={cn(
        "text-sm font-bold tabular-nums",
        score >= 70 ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
      )}>
        {score}
      </span>
    </div>
  );
}

export function DealRiskPanel({ opportunityId, data: propData }: DealRiskPanelProps) {
  const { data: fetched, loading, error } = useApi<ScoresData>(
    propData ? null : `/api/opportunities/${opportunityId}/scores`
  );

  const scores = propData ?? fetched;

  if (loading && !scores) {
    return <SkeletonBlock />;
  }

  if (error) {
    return (
      <GlassCard>
        <p className="text-xs text-[var(--accent-red)]">{error}</p>
      </GlassCard>
    );
  }

  if (!scores) return null;

  const toneInfo = toneLabels[scores.tone] ?? { label: scores.tone, color: "text-[var(--text-secondary)]" };

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {/* Scores section */}
      <GlassCard className="flex flex-col gap-[var(--space-md)]">
        <SectionLabel>Scores do Deal</SectionLabel>
        <div className="flex flex-col gap-[var(--space-sm)]">
          <ScoreRow label="Risco" score={scores.riskScore} statusFn={riskToStatus} />
          <ScoreRow label="Intencao" score={scores.intentScore} statusFn={scoreToStatus} />
          <ScoreRow label="Momentum" score={scores.momentumScore} statusFn={scoreToStatus} />
        </div>
      </GlassCard>

      {/* Money metrics */}
      <GlassCard className="flex flex-col gap-[var(--space-md)]">
        <SectionLabel>Impacto Financeiro</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-md)]">
          <MetricValue
            value={formatBRL(scores.moneyAtRisk)}
            label="Em risco"
            size="sm"
            trend={scores.moneyAtRisk > 50000 ? "down" : "stable"}
          />
          <MetricValue
            value={formatBRL(scores.commissionAtRisk)}
            label="Comissao"
            size="sm"
          />
          <MetricValue
            value={formatBRL(scores.delayCost)}
            label="Custo atraso"
            size="sm"
          />
        </div>
      </GlassCard>

      {/* Tone indicator */}
      <GlassCard className="flex items-center justify-between">
        <SectionLabel>Tom da Negociacao</SectionLabel>
        <span className={cn("text-sm font-bold", toneInfo.color)}>
          {toneInfo.label}
        </span>
      </GlassCard>

      {/* Next action */}
      {scores.nextAction && (
        <GlassCard className="flex flex-col gap-[var(--space-xs)] border-l-2 border-l-[var(--accent-gold)]">
          <SectionLabel>Proxima Acao Recomendada</SectionLabel>
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            {scores.nextAction}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
