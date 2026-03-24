"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatRelativeTime, getInitials } from "@/lib/utils";
import { useApi } from "@/lib/hooks/use-api";
import { TableSkeleton } from "@/components/shared/skeleton";

export default function AccountsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const queryParams = new URLSearchParams({ limit: "50" });
  if (search) queryParams.set("search", search);

  const { data: accounts, loading } = useApi<any[]>(`/api/accounts?${queryParams.toString()}`);

  const displayAccounts = accounts ?? [];

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Manage your account portfolio"
        actions={
          <button
            onClick={() => router.push("/accounts/new")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            + New Account
          </button>
        }
      />

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
              placeholder="Search accounts..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
            />
          </div>
          <span className="text-xs text-muted">
            {loading ? "Loading..." : `${displayAccounts.length} accounts`}
          </span>
        </div>

        {loading && displayAccounts.length === 0 ? (
          <TableSkeleton rows={5} cols={7} />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Size</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Annual Revenue</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted">Opportunities</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Created</th>
              </tr>
            </thead>
            <tbody>
              {displayAccounts.map((acc: any) => (
                <tr
                  key={acc.id}
                  onClick={() => router.push(`/accounts/${acc.id}`)}
                  className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-xs font-bold text-primary">
                        {getInitials(acc.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{acc.name}</p>
                        <p className="text-xs text-muted">{acc.company?.website || ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted">{acc.company?.industry || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">{acc.company?.size || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-foreground">
                      {acc.company?.annualRevenue ? formatCurrency(acc.company.annualRevenue, "BRL") : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      (acc.opportunities?.length ?? 0) > 0 ? "bg-primary-light text-primary" : "bg-background text-muted"
                    }`}>
                      {acc.opportunities?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">
                        {getInitials(acc.owner?.name || "?")}
                      </div>
                      <span className="text-sm text-muted">{(acc.owner?.name || "").split(" ")[0]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted">{formatRelativeTime(acc.createdAt)}</span>
                  </td>
                </tr>
              ))}
              {displayAccounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    No accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
