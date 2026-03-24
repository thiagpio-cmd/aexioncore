"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/health-badge";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { useApi } from "@/lib/hooks/use-api";
import { CreateLeadModal } from "@/components/leads/create-lead-modal";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/shared/skeleton";

type FilterTab = "ALL" | "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "UNQUALIFIED";

export default function LeadsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [showCreate, setShowCreate] = useState(false);

  const queryParams = new URLSearchParams({ limit: "50" });
  if (filter !== "ALL") queryParams.set("status", filter);
  if (search) queryParams.set("search", search);

  const { data: leads, loading, refetch } = useApi<any[]>(`/api/leads?${queryParams.toString()}`);

  // For tab counts, we fetch all without status filter
  const { data: allLeads, refetch: refetchAll } = useApi<any[]>("/api/leads?limit=200");

  const tabs: { key: FilterTab; label: string; count: number }[] = useMemo(() => [
    { key: "ALL", label: "All", count: allLeads?.length ?? 0 },
    { key: "NEW", label: "New", count: allLeads?.filter((l: any) => l.status === "NEW").length ?? 0 },
    { key: "CONTACTED", label: "Contacted", count: allLeads?.filter((l: any) => l.status === "CONTACTED").length ?? 0 },
    { key: "QUALIFIED", label: "Qualified", count: allLeads?.filter((l: any) => l.status === "QUALIFIED").length ?? 0 },
    { key: "CONVERTED", label: "Converted", count: allLeads?.filter((l: any) => l.status === "CONVERTED").length ?? 0 },
  ], [allLeads]);

  const displayLeads = leads ?? [];

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Manage and qualify your lead pipeline"
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/api/export?type=leads"
              download
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              ↓ Export CSV
            </a>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              + New Lead
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
      <div className="rounded-xl border border-border/60 bg-surface shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
            <circle cx="9" cy="9" r="6" />
            <path d="m13.5 13.5 4 4" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
          />
          <span className="text-xs text-muted">
            {loading ? "Loading..." : `${displayLeads.length} leads`}
          </span>
        </div>

        {loading && displayLeads.length === 0 ? (
          <TableSkeleton rows={6} cols={8} />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Lead</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Temperature</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Fit Score</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted/70 uppercase tracking-wider">Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {displayLeads.map((lead: any) => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="border-b border-border/40 last:border-0 cursor-pointer transition-colors hover:bg-background/60"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{lead.name}</p>
                      <p className="text-xs text-muted">{lead.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-foreground">{lead.company?.name || lead.company || "—"}</p>
                      <p className="text-xs text-muted">{lead.title || ""}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.temperature} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 rounded-full bg-background">
                        <div
                          className={`h-1.5 rounded-full ${
                            lead.fitScore >= 70 ? "bg-success" : lead.fitScore >= 40 ? "bg-warning" : "bg-danger"
                          }`}
                          style={{ width: `${lead.fitScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{lead.fitScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted">{lead.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">
                        {getInitials(lead.owner?.name || "?")}
                      </div>
                      <span className="text-sm text-muted">{(lead.owner?.name || "").split(" ")[0]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted">
                      {lead.lastContact ? formatRelativeTime(lead.lastContact) : "Never"}
                    </span>
                  </td>
                </tr>
              ))}
              {displayLeads.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                    No leads found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <CreateLeadModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { refetch(); refetchAll(); }}
        currentUserId={session?.user?.id}
      />
    </div>
  );
}
