"use client";

import { useState, useCallback } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { GlassCard } from "@/components/design-system/GlassCard";
import { CustomerProfileCard } from "./CustomerProfileCard";

interface MatchData {
  icpId: string;
  icpName: string;
  totalEvaluated: number;
  matches: Array<{
    contactId: string;
    contactName: string;
    contactEmail: string;
    companyName: string | null;
    profileId: string | null;
    match: {
      score: number;
      dimensionScores: {
        bigFive: number;
        valueSensitivity: number;
        motivation: number;
        conditioning: number;
        archetype: number;
      };
      signals: string[];
      matchedAt: string;
    };
  }>;
}

type FitTier = "CHAMPION" | "HIGH_FIT" | "MEDIUM_FIT" | "LOW_FIT" | "DISQUALIFIED";

function getFitTier(score: number): FitTier {
  if (score >= 80) return "CHAMPION";
  if (score >= 65) return "HIGH_FIT";
  if (score >= 45) return "MEDIUM_FIT";
  if (score >= 25) return "LOW_FIT";
  return "DISQUALIFIED";
}

const FIT_STYLES: Record<FitTier, { label: string; color: string; bg: string }> = {
  CHAMPION: { label: "Champion", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  HIGH_FIT: { label: "Alto Fit", color: "text-[var(--accent)]", bg: "bg-[var(--accent)]/10" },
  MEDIUM_FIT: { label: "Medio", color: "text-amber-400", bg: "bg-amber-400/10" },
  LOW_FIT: { label: "Baixo", color: "text-[var(--text-muted)]", bg: "bg-[var(--text-muted)]/10" },
  DISQUALIFIED: { label: "Desqualificado", color: "text-red-400", bg: "bg-red-400/10" },
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-[var(--text-muted)] w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-[var(--text-primary)] w-5 text-right">
        {Math.round(value)}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-3">
      <div className="h-8 w-8 rounded-full bg-[var(--border-subtle)]" />
      <div className="flex-1 space-y-1">
        <div className="h-3 w-32 rounded bg-[var(--border-subtle)]" />
        <div className="h-2.5 w-24 rounded bg-[var(--border-subtle)]" />
      </div>
      <div className="h-6 w-16 rounded bg-[var(--border-subtle)]" />
    </div>
  );
}

interface ICPMatchListProps {
  icpId: string;
}

export function ICPMatchList({ icpId }: ICPMatchListProps) {
  const { data, loading, error } = useApi<MatchData>(
    `/api/icp/${icpId}/matches`
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  const handleRowClick = useCallback((contactId: string, name: string) => {
    setSelectedContactId(contactId);
    setSelectedName(name);
  }, []);

  if (loading) {
    return (
      <GlassCard className="p-0 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-red-400">Erro ao carregar matches: {error}</p>
      </GlassCard>
    );
  }

  if (!data || data.matches.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <svg className="mx-auto h-10 w-10 text-[var(--text-muted)] mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <p className="text-sm text-[var(--text-muted)]">
          Nenhum contato corresponde a este ICP.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {data?.totalEvaluated ?? 0} contatos avaliados
        </p>
      </GlassCard>
    );
  }

  // Profile slide-over
  if (selectedContactId) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedContactId(null)}
          className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Voltar para lista
        </button>
        <CustomerProfileCard
          contactId={selectedContactId}
          contactName={selectedName}
          onClose={() => setSelectedContactId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-[var(--text-muted)]">
          {data.matches.length} match{data.matches.length !== 1 ? "es" : ""} de{" "}
          {data.totalEvaluated} avaliados
        </p>
      </div>

      <GlassCard className="p-0 overflow-hidden divide-y divide-[var(--border-subtle)]">
        {data.matches.map((m) => {
          const tier = getFitTier(m.match.score);
          const style = FIT_STYLES[tier];

          return (
            <button
              key={m.contactId}
              onClick={() => handleRowClick(m.contactId, m.contactName)}
              className="w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
            >
              {/* Score circle */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style.bg} ${style.color}`}
              >
                {Math.round(m.match.score)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {m.contactName}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.color}`}
                  >
                    {style.label}
                  </span>
                </div>
                {m.companyName && (
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {m.companyName}
                  </p>
                )}

                {/* Mini breakdown */}
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <ScoreBar label="B5" value={m.match.dimensionScores.bigFive} />
                  <ScoreBar label="Val" value={m.match.dimensionScores.valueSensitivity} />
                  <ScoreBar label="Mot" value={m.match.dimensionScores.motivation} />
                  <ScoreBar label="Arq" value={m.match.dimensionScores.archetype} />
                </div>

                {/* Signals */}
                {m.match.signals.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.match.signals.map((s, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-[var(--text-muted)] bg-[var(--glass-bg)] rounded px-1.5 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Chevron */}
              <svg
                className="shrink-0 mt-2 text-[var(--text-muted)]"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          );
        })}
      </GlassCard>
    </div>
  );
}
