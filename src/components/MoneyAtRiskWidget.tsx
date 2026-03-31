"use client";

import { GlassCard, MetricValue, SectionLabel } from "@/components/design-system";
import { useApi } from "@/lib/hooks/use-api";
import { cn } from "@/lib/utils";

interface MoneyData {
  moneyAtRisk: number;
  commissionAtRisk: number;
  delayCost: number;
}

interface MoneyAtRiskWidgetProps {
  opportunityId?: string;
  /** Pass data directly instead of fetching */
  data?: MoneyData;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className={cn("h-4 rounded bg-[var(--glass-border)] animate-pulse", width)}
    />
  );
}

export function MoneyAtRiskWidget({ opportunityId, data: propData }: MoneyAtRiskWidgetProps) {
  const url = opportunityId ? `/api/opportunities/${opportunityId}/money` : null;
  const { data: fetched, loading, error } = useApi<MoneyData>(
    propData ? null : url
  );

  const money = propData ?? fetched;
  const totalRisk = money ? money.moneyAtRisk + money.commissionAtRisk + money.delayCost : 0;
  const isHighRisk = totalRisk > 50000;

  if (loading && !money) {
    return (
      <GlassCard className="flex flex-col gap-[var(--space-md)]">
        <SkeletonLine width="w-24" />
        <SkeletonLine width="w-40" />
        <div className="flex flex-col gap-[var(--space-xs)]">
          <SkeletonLine width="w-32" />
          <SkeletonLine width="w-28" />
          <SkeletonLine width="w-24" />
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <p className="text-xs text-[var(--accent-red)]">{error}</p>
      </GlassCard>
    );
  }

  if (!money) return null;

  return (
    <GlassCard
      className={cn(
        "flex flex-col gap-[var(--space-md)]",
        isHighRisk && "border-[var(--accent-red)]/30"
      )}
    >
      <div className="flex items-center justify-between">
        <SectionLabel>Dinheiro em Risco</SectionLabel>
        {isHighRisk && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-red)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-red)]">
            Alto risco
          </span>
        )}
      </div>

      <MetricValue
        value={formatBRL(totalRisk)}
        label="Total em risco"
        size="lg"
        trend={isHighRisk ? "down" : "stable"}
      />

      <div className="flex flex-col gap-[var(--space-sm)] border-t border-[var(--glass-border)] pt-[var(--space-md)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Receita em risco</span>
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            money.moneyAtRisk > 0 ? "text-[var(--accent-red)]" : "text-[var(--text-muted)]"
          )}>
            {formatBRL(money.moneyAtRisk)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Comissao em risco</span>
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            money.commissionAtRisk > 0 ? "text-[var(--accent-gold)]" : "text-[var(--text-muted)]"
          )}>
            {formatBRL(money.commissionAtRisk)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Custo de atraso</span>
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            money.delayCost > 0 ? "text-[var(--accent-red)]" : "text-[var(--text-muted)]"
          )}>
            {formatBRL(money.delayCost)}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
