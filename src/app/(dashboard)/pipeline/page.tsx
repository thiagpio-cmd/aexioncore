"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApi, apiPut, apiPost } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { CreateOpportunityModal } from "@/components/opportunities/create-opportunity-modal";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/shared/skeleton";

type ViewMode = "kanban" | "table" | "list";

const STAGES = [
  { id: "DISCOVERY", name: "Discovery", color: "bg-blue-500", order: 1 },
  { id: "QUALIFICATION", name: "Qualification", color: "bg-indigo-500", order: 2 },
  { id: "PROPOSAL", name: "Proposal", color: "bg-purple-500", order: 3 },
  { id: "NEGOTIATION", name: "Negotiation", color: "bg-amber-500", order: 4 },
  { id: "CLOSED_WON", name: "Closed Won", color: "bg-emerald-500", order: 5 },
  { id: "CLOSED_LOST", name: "Closed Lost", color: "bg-red-500", order: 6 },
];

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  ownerName?: string;
  owner?: { name: string };
  account?: { name: string };
  accountId?: string;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
}

function getDaysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}

function DealCard({
  deal,
  onClick,
  onDragStart,
  isDragging,
}: {
  deal: Deal;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  isDragging: boolean;
}) {
  const ownerName = deal.ownerName || deal.owner?.name || "Unassigned";
  const accountName = deal.account?.name || "";
  const aging = getDaysInStage(deal.updatedAt);
  const healthScore = deal.probability || 50;
  const isRisk = healthScore < 40 || aging > 21;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-surface p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-primary/30",
        isRisk ? "border-danger/30" : "border-border",
        isDragging && "opacity-40 scale-95"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-foreground leading-tight">{deal.title}</p>
        {isRisk && (
          <span className="shrink-0 ml-2 h-2 w-2 rounded-full bg-danger" title="At Risk" />
        )}
      </div>
      <p className="text-xs text-muted mb-2">{accountName}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value, "BRL")}</span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-8 rounded-full bg-background">
            <div
              className={cn(
                "h-1.5 rounded-full",
                healthScore >= 70 ? "bg-success" : healthScore >= 40 ? "bg-warning" : "bg-danger"
              )}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          <span className="text-[10px] text-muted">{healthScore}%</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-light text-[8px] font-semibold text-primary">
            {getInitials(ownerName)}
          </div>
          <span className="text-[11px] text-muted">{ownerName.split(" ")[0]}</span>
        </div>
        {aging > 0 && (
          <span className={cn(
            "text-[11px]",
            aging > 14 ? "text-danger" : aging > 7 ? "text-warning" : "text-muted"
          )}>
            {aging}d
          </span>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const { data: deals, loading, refetch } = useApi<Deal[]>("/api/opportunities?limit=100");
  const items = deals || [];

  const filteredDeals = items.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.account?.name || "").toLowerCase().includes(q) ||
      (d.ownerName || d.owner?.name || "").toLowerCase().includes(q)
    );
  });

  const activeStages = STAGES.filter((s) => s.id !== "CLOSED_WON" && s.id !== "CLOSED_LOST");
  const activeDeals = items.filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST");
  const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);
  const wonDeals = items.filter((d) => d.stage === "CLOSED_WON");
  const lostDeals = items.filter((d) => d.stage === "CLOSED_LOST");
  const atRiskDeals = activeDeals.filter((d) => (d.probability || 50) < 40 || getDaysInStage(d.updatedAt) > 21);
  const avgHealth = activeDeals.length > 0
    ? Math.round(activeDeals.reduce((s, d) => s + (d.probability || 50), 0) / activeDeals.length)
    : 0;

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dealId);
    setDraggingId(dealId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragOverStage(null);

    if (!dealId) return;

    const deal = items.find((d) => d.id === dealId);
    if (!deal || deal.stage === targetStage) return;

    setUpdating(true);
    const { error } = await apiPost(`/api/opportunities/${dealId}/stage-transition`, {
      targetStage,
      note: `Moved to ${STAGES.find((s) => s.id === targetStage)?.name || targetStage} via pipeline`,
    });
    setUpdating(false);

    if (error) {
      toastError(error);
      return;
    }

    const stageName = STAGES.find((s) => s.id === targetStage)?.name || targetStage;
    toastSuccess(`"${deal.title}" moved to ${stageName}`);
    refetch();
  }, [items, refetch, toastSuccess, toastError]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverStage(null);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Pipeline" description="Visual pipeline management" />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <PageHeader
        title="Pipeline"
        description="Visual pipeline management"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {(["kanban", "table", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    view === v ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                  )}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
            >
              + New Deal
            </button>
          </div>
        }
      />

      {/* Search */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
          <circle cx="9" cy="9" r="6" /><path d="m13.5 13.5 4 4" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deals..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/50"
        />
      </div>

      {updating && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary-light px-3 py-2 text-xs text-primary">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Updating pipeline...
        </div>
      )}

      {view === "kanban" && (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 pb-4" style={{ minWidth: `${STAGES.length * 280}px` }}>
            {STAGES.map((stage) => {
              const stageDeals = filteredDeals.filter((d) => d.stage === stage.id);
              const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);
              const isDropTarget = dragOverStage === stage.id;
              return (
                <div
                  key={stage.id}
                  className="flex w-[272px] shrink-0 flex-col"
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                      <span className="text-sm font-semibold text-foreground">{stage.name}</span>
                      <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] text-muted">{stageDeals.length}</span>
                    </div>
                    <span className="text-xs font-medium text-muted">{formatCurrency(stageTotal, "BRL")}</span>
                  </div>
                  <div
                    className={cn(
                      "flex-1 space-y-2 rounded-xl p-2 transition-colors",
                      isDropTarget
                        ? "bg-primary/10 border-2 border-dashed border-primary"
                        : "bg-background/50"
                    )}
                  >
                    {stageDeals.length === 0 ? (
                      <div className={cn(
                        "flex items-center justify-center rounded-lg border border-dashed py-8 transition-colors",
                        isDropTarget ? "border-primary bg-primary/5" : "border-border"
                      )}>
                        <p className="text-xs text-muted">
                          {isDropTarget ? "Drop here" : "No deals"}
                        </p>
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onClick={() => router.push(`/opportunities/${deal.id}`)}
                          onDragStart={handleDragStart}
                          isDragging={draggingId === deal.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "table" && (
        <div className="rounded-xl border border-border bg-surface overflow-auto flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Deal</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Probability</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Close Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Aging</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => {
                const stage = STAGES.find((s) => s.id === deal.stage);
                const ownerName = deal.ownerName || deal.owner?.name || "Unassigned";
                const aging = getDaysInStage(deal.updatedAt);
                const healthScore = deal.probability || 50;
                const isRisk = healthScore < 40 || aging > 21;
                return (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/opportunities/${deal.id}`)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-background transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isRisk && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
                        <span className="text-sm font-medium text-foreground">{deal.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{deal.account?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{formatCurrency(deal.value, "BRL")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white", stage?.color || "bg-gray-500")}>
                        {stage?.name || deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-10 rounded-full bg-background">
                          <div className={cn("h-1.5 rounded-full", healthScore >= 70 ? "bg-success" : healthScore >= 40 ? "bg-warning" : "bg-danger")} style={{ width: `${healthScore}%` }} />
                        </div>
                        <span className="text-xs text-muted">{healthScore}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">{getInitials(ownerName)}</div>
                        <span className="text-sm text-muted">{ownerName.split(" ")[0]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {deal.expectedCloseDate
                        ? new Date(deal.expectedCloseDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm", aging > 14 ? "text-danger font-medium" : aging > 7 ? "text-warning" : "text-muted")}>
                        {aging > 0 ? `${aging}d` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "list" && (
        <div className="flex-1 space-y-2 overflow-auto">
          {filteredDeals.map((deal) => {
            const stage = STAGES.find((s) => s.id === deal.stage);
            const ownerName = deal.ownerName || deal.owner?.name || "Unassigned";
            const aging = getDaysInStage(deal.updatedAt);
            const healthScore = deal.probability || 50;
            const isRisk = healthScore < 40 || aging > 21;
            return (
              <div
                key={deal.id}
                onClick={() => router.push(`/opportunities/${deal.id}`)}
                className={cn(
                  "flex items-center justify-between rounded-xl border bg-surface px-5 py-4 cursor-pointer transition-all hover:shadow-sm",
                  isRisk ? "border-danger/30" : "border-border"
                )}
              >
                <div className="flex items-center gap-4">
                  {isRisk && <span className="h-2.5 w-2.5 rounded-full bg-danger" />}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{deal.title}</p>
                    <p className="text-xs text-muted">{deal.account?.name || ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium text-white", stage?.color)}>{stage?.name || deal.stage}</span>
                  <span className="text-sm font-semibold text-foreground w-24 text-right">{formatCurrency(deal.value, "BRL")}</span>
                  <div className="flex items-center gap-1.5 w-16">
                    <div className="h-1.5 w-8 rounded-full bg-background">
                      <div className={cn("h-1.5 rounded-full", healthScore >= 70 ? "bg-success" : healthScore >= 40 ? "bg-warning" : "bg-danger")} style={{ width: `${healthScore}%` }} />
                    </div>
                    <span className="text-xs text-muted">{healthScore}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">{getInitials(ownerName)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline Summary */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-muted">Total Pipeline</span>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalPipeline, "BRL")}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-xs text-muted">Active Deals</span>
            <p className="text-lg font-bold text-foreground">{activeDeals.length}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-xs text-muted">At Risk</span>
            <p className="text-lg font-bold text-danger">{atRiskDeals.length}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-xs text-muted">Avg. Probability</span>
            <p className="text-lg font-bold text-foreground">{avgHealth}%</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-muted">Won</span>
            <p className="text-lg font-bold text-success">{formatCurrency(wonDeals.reduce((s, d) => s + d.value, 0), "BRL")}</p>
          </div>
          <div>
            <span className="text-xs text-muted">Lost</span>
            <p className="text-lg font-bold text-danger">{formatCurrency(lostDeals.reduce((s, d) => s + d.value, 0), "BRL")}</p>
          </div>
        </div>
      </div>

      <CreateOpportunityModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refetch(); }}
        currentUserId={user?.id}
      />
    </div>
  );
}
