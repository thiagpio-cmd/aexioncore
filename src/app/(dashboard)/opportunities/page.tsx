"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { HealthBadge } from "@/components/shared/health-badge";
import { formatCurrency, getInitials } from "@/lib/utils";
import { useApi } from "@/lib/hooks/use-api";
import { CreateOpportunityModal } from "@/components/opportunities/create-opportunity-modal";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/shared/skeleton";

const STAGE_COLORS: Record<string, string> = {
  DISCOVERY: "bg-blue-50 text-blue-700",
  QUALIFICATION: "bg-indigo-50 text-indigo-700",
  PROPOSAL: "bg-violet-50 text-violet-700",
  NEGOTIATION: "bg-amber-50 text-amber-700",
  CLOSED_WON: "bg-emerald-50 text-emerald-700",
  CLOSED_LOST: "bg-red-50 text-red-700",
};

type FilterTab = "ALL" | "DISCOVERY" | "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST";

export default function OpportunitiesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const { data: allOpps, loading, refetch } = useApi<any[]>("/api/opportunities?limit=100");

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
    { key: "DISCOVERY", label: "Discovery", count: allOpps?.filter((o: any) => o.stage === "DISCOVERY").length ?? 0 },
    { key: "QUALIFICATION", label: "Qualification", count: allOpps?.filter((o: any) => o.stage === "QUALIFICATION").length ?? 0 },
    { key: "PROPOSAL", label: "Proposal", count: allOpps?.filter((o: any) => o.stage === "PROPOSAL").length ?? 0 },
    { key: "NEGOTIATION", label: "Negotiation", count: allOpps?.filter((o: any) => o.stage === "NEGOTIATION").length ?? 0 },
    { key: "CLOSED_WON", label: "Closed Won", count: allOpps?.filter((o: any) => o.stage === "CLOSED_WON").length ?? 0 },
    { key: "CLOSED_LOST", label: "Closed Lost", count: allOpps?.filter((o: any) => o.stage === "CLOSED_LOST").length ?? 0 },
  ], [allOpps]);

  const totalValue = filtered.reduce((sum: number, o: any) => sum + (o.value || 0), 0);

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

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
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
      <div className="rounded-xl border border-border bg-surface">
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
          <table className="w-full">
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
              {filtered.map((opp: any) => (
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
                      {(opp.stage || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
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

      <CreateOpportunityModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => refetch()}
        currentUserId={session?.user?.id}
      />
    </div>
  );
}
