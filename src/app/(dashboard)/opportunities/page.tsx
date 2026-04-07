"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { HealthBadge } from "@/components/shared/health-badge";
import { formatCurrency, getInitials } from "@/lib/utils";
import { useApi } from "@/lib/hooks/use-api";
import { CreateOpportunityModal } from "@/components/opportunities/create-opportunity-modal";
import { Pagination } from "@/components/pagination";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/shared/skeleton";
import { AIInsightBanner } from "@/components/ai/ai-insight-banner";

/** Convert DB stage names like LOI_SUBMITTED → "Loi Submitted" */
function stageLabel(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: "bg-slate-50 text-slate-700",
  INITIAL_CONTACT: "bg-blue-50 text-blue-700",
  PROPERTY_TOUR: "bg-indigo-50 text-indigo-700",
  LOI_SUBMITTED: "bg-violet-50 text-violet-700",
  LOI_NEGOTIATION: "bg-purple-50 text-purple-700",
  UNDER_CONTRACT: "bg-amber-50 text-amber-700",
  DUE_DILIGENCE: "bg-cyan-50 text-cyan-700",
  FINANCING: "bg-teal-50 text-teal-700",
  CLOSING: "bg-lime-50 text-lime-700",
  CLOSED_WON: "bg-emerald-50 text-emerald-700",
  CLOSED_LOST: "bg-red-50 text-red-700",
};

type FilterTab = "ALL" | "PROSPECTING" | "INITIAL_CONTACT" | "PROPERTY_TOUR" | "LOI_SUBMITTED" | "LOI_NEGOTIATION" | "UNDER_CONTRACT" | "DUE_DILIGENCE" | "FINANCING" | "CLOSING" | "CLOSED_WON" | "CLOSED_LOST";

export default function OpportunitiesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 15;

  const { data: allOpps, loading, refetch } = useApi<any[]>("/api/opportunities?limit=200");

  const filtered = useMemo(() => {
    if (!allOpps) return [];
    return allOpps.filter((opp: any) => {
      if (filter !== "ALL" && opp.stage !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          opp.title?.toLowerCase().includes(q) ||
          opp.account?.name?.toLowerCase().includes(q) ||
          opp.owner?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allOpps, filter, search]);

  const tabs: { key: FilterTab; label: string; count: number }[] = useMemo(() => [
    { key: "ALL", label: "All", count: allOpps?.length ?? 0 },
    { key: "PROSPECTING", label: "Prospecting", count: allOpps?.filter((o: any) => o.stage === "PROSPECTING").length ?? 0 },
    { key: "INITIAL_CONTACT", label: "Initial Contact", count: allOpps?.filter((o: any) => o.stage === "INITIAL_CONTACT").length ?? 0 },
    { key: "PROPERTY_TOUR", label: "Property Tour", count: allOpps?.filter((o: any) => o.stage === "PROPERTY_TOUR").length ?? 0 },
    { key: "LOI_SUBMITTED", label: "LOI Submitted", count: allOpps?.filter((o: any) => o.stage === "LOI_SUBMITTED").length ?? 0 },
    { key: "LOI_NEGOTIATION", label: "LOI Negotiation", count: allOpps?.filter((o: any) => o.stage === "LOI_NEGOTIATION").length ?? 0 },
    { key: "UNDER_CONTRACT", label: "Under Contract", count: allOpps?.filter((o: any) => o.stage === "UNDER_CONTRACT").length ?? 0 },
    { key: "DUE_DILIGENCE", label: "Due Diligence", count: allOpps?.filter((o: any) => o.stage === "DUE_DILIGENCE").length ?? 0 },
    { key: "FINANCING", label: "Financing", count: allOpps?.filter((o: any) => o.stage === "FINANCING").length ?? 0 },
    { key: "CLOSING", label: "Closing", count: allOpps?.filter((o: any) => o.stage === "CLOSING").length ?? 0 },
    { key: "CLOSED_WON", label: "Closed Won", count: allOpps?.filter((o: any) => o.stage === "CLOSED_WON").length ?? 0 },
    { key: "CLOSED_LOST", label: "Closed Lost", count: allOpps?.filter((o: any) => o.stage === "CLOSED_LOST").length ?? 0 },
  ], [allOpps]);

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1); }, [filter, search]);

  const totalValue = filtered.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginatedOpps = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <PageHeader
        title="Opportunities"
        description="Track and close your deals"
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/api/export?type=opportunities"
              download
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              ↓ Export CSV
            </a>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              + New Opportunity
            </button>
          </div>
        }
      />

      {/* AI Deals Insight */}
      <AIInsightBanner
        prompt="Which CRE opportunities need immediate attention? Analyze by cap rate, deal stage, and days since last activity."
        compact
        className="mb-3"
      />

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              filter === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-xs text-muted">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-x-auto">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <circle cx="9" cy="9" r="6" />
              <path d="m13.5 13.5 4 4" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted">
              {loading ? "Loading..." : `${filtered.length} opportunities`}
            </span>
            <span className="text-xs font-medium text-foreground">Total: {formatCurrency(totalValue, "USD")}</span>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Deal</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Account</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Health</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Close Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Probability</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOpps.map((opp: any) => (
                <tr
                  key={opp.id}
                  onClick={() => router.push(`/opportunities/${opp.id}`)}
                  className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{opp.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-muted">{opp.account?.name || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(opp.value || 0, "USD")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[opp.stage] || "bg-gray-50 text-gray-600"}`}>
                      {stageLabel(opp.stage || "")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge score={opp.healthScore || 0} showLabel={false} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">
                        {getInitials(opp.owner?.name || "?")}
                      </div>
                      <span className="text-sm text-muted">{(opp.owner?.name || "").split(" ")[0]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted">
                      {opp.expectedCloseDate
                        ? new Date(opp.expectedCloseDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-10 rounded-full bg-background">
                        <div
                          className={`h-1.5 rounded-full ${
                            (opp.probability || 0) >= 60 ? "bg-success" : (opp.probability || 0) >= 30 ? "bg-warning" : "bg-danger"
                          }`}
                          style={{ width: `${opp.probability || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted">{opp.probability || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                    No opportunities found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        limit={perPage}
        onPageChange={setPage}
      />

      <CreateOpportunityModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetch()}
        currentUserId={session?.user?.id}
      />
    </div>
  );
}
