"use client";

import { useState, useCallback } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { GlassCard } from "@/components/design-system/GlassCard";
import { StatusDot } from "@/components/design-system/StatusDot";
import { ICPTemplateForm } from "@/components/icp/ICPTemplateForm";
import { ICPMatchList } from "@/components/icp/ICPMatchList";

interface ICPProfileItem {
  id: string;
  name: string;
  isActive: boolean;
  decisionStyle: string | null;
  riskTolerance: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { icpScores: number };
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-2">
          <div className="h-4 w-40 rounded bg-[var(--border-subtle)]" />
          <div className="h-3 w-24 rounded bg-[var(--border-subtle)]" />
        </div>
      ))}
    </div>
  );
}

export default function ICPPage() {
  const { data: icps, loading, error, refetch } = useApi<ICPProfileItem[]>("/api/icp");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const selectedIcp = icps?.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Perfil de Cliente Ideal
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Defina perfis ICP e encontre contatos com maior aderencia
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedId(null);
          }}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          Novo ICP
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16">
          <div className="w-full max-w-xl">
            <GlassCard elevated className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Novo Perfil ICP
              </h2>
              <ICPTemplateForm
                onSuccess={handleFormSuccess}
                onCancel={() => setShowForm(false)}
              />
            </GlassCard>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* ICP List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Perfis ICP
          </h2>

          {loading && <SkeletonCards />}

          {error && (
            <GlassCard className="p-4">
              <p className="text-sm text-red-400">Erro ao carregar: {error}</p>
            </GlassCard>
          )}

          {!loading && !error && (!icps || icps.length === 0) && (
            <GlassCard className="p-6 text-center">
              <svg
                className="mx-auto h-12 w-12 text-[var(--text-muted)] mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
                <path d="M9 21h6" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum perfil ICP criado ainda.
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Crie seu primeiro ICP para comecar a encontrar matches.
              </p>
            </GlassCard>
          )}

          {icps &&
            icps.map((icp) => {
              const isSelected = selectedId === icp.id;
              return (
                <GlassCard
                  key={icp.id}
                  onClick={() => setSelectedId(isSelected ? null : icp.id)}
                  className={`text-left ${
                    isSelected
                      ? "ring-1 ring-[var(--accent)] border-[var(--accent)]/30"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {icp.name}
                        </h3>
                        <StatusDot
                          status={icp.isActive ? "success" : "neutral"}
                          size="sm"
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        {icp.decisionStyle && (
                          <span>
                            {icp.decisionStyle === "ANALYTICAL"
                              ? "Analitico"
                              : icp.decisionStyle === "INTUITIVE"
                                ? "Intuitivo"
                                : icp.decisionStyle === "CONSENSUS"
                                  ? "Consenso"
                                  : "Autoritario"}
                          </span>
                        )}
                        {icp.riskTolerance && (
                          <span>
                            Risco:{" "}
                            {icp.riskTolerance === "LOW"
                              ? "Baixo"
                              : icp.riskTolerance === "MEDIUM"
                                ? "Medio"
                                : "Alto"}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--glass-bg)] border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                      {icp._count.icpScores} match{icp._count.icpScores !== 1 ? "es" : ""}
                    </span>
                  </div>
                </GlassCard>
              );
            })}
        </div>

        {/* Detail / Matches */}
        <div>
          {!selectedId && (
            <GlassCard className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
              <svg
                className="h-10 w-10 text-[var(--text-muted)] mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122M5.98 11.95l-2.121 2.122" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">
                Selecione um perfil ICP para ver os matches
              </p>
            </GlassCard>
          )}

          {selectedId && selectedIcp && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Matches: {selectedIcp.name}
                </h2>
              </div>
              <ICPMatchList icpId={selectedId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
