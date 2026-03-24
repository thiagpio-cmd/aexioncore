"use client";

import Link from "next/link";
import { use } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { StatCard } from "@/components/shared/stat-card";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { formatCurrency } from "@/lib/utils";

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: account, loading: accountLoading, error: accountError } = useApi<any>(`/api/accounts/${id}`);
  const { data: contacts, loading: contactsLoading } = useApi<any[]>(account?.companyId ? `/api/contacts?companyId=${account.companyId}` : null);
  const { data: opps, loading: oppsLoading } = useApi<any[]>(`/api/opportunities?accountId=${id}`);

  if (accountLoading) {
    return <DetailSkeleton />;
  }

  if (accountError || !account) {
    return (
      <div>
        <Link href="/accounts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Back
        </Link>
        <p className="text-sm text-muted">{accountError || "Account not found."}</p>
      </div>
    );
  }

  const contactList = contacts || [];
  const oppList = opps || [];
  const totalPipeline = oppList
    .filter((o: any) => !["CLOSED_WON", "CLOSED_LOST"].includes(o.stage))
    .reduce((s: number, o: any) => s + (o.value || 0), 0);
  const wonValue = oppList
    .filter((o: any) => o.stage === "CLOSED_WON")
    .reduce((s: number, o: any) => s + (o.value || 0), 0);
  const openDeals = oppList.filter((o: any) => !["CLOSED_WON", "CLOSED_LOST"].includes(o.stage)).length;

  return (
    <div className="space-y-6">
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to Accounts
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{account.name}</h1>
          <p className="text-sm text-muted">
            {account.company?.industry || account.industry || "—"}
            {" · "}
            {account.company?.size || account.size || "—"} employees
            {account.company?.website || account.website ? ` · ${account.company?.website || account.website}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Owner</p>
          <p className="text-sm font-medium text-foreground">{account.owner?.name || "Unassigned"}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Annual Revenue"
          value={formatCurrency(account.company?.annualRevenue || account.annualRevenue || 0, "USD")}
          change={account.company?.industry || account.industry || ""}
          changeType="neutral"
        />
        <StatCard label="Open Pipeline" value={formatCurrency(totalPipeline, "USD")} change={`${openDeals} deals`} changeType="neutral" />
        <StatCard label="Won Revenue" value={formatCurrency(wonValue, "USD")} change="Lifetime" changeType="positive" />
        <StatCard label="Contacts" value={contactList.length} change="In this account" changeType="neutral" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Contacts</h3>
          <div className="space-y-3">
            {contactsLoading && <p className="text-xs text-muted">Loading contacts...</p>}
            {!contactsLoading && contactList.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted">{c.title} · {c.email}</p>
                </div>
                <div className="flex gap-2">
                  {c.isChampion && <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-success">Champion</span>}
                  {c.isDecisionMaker && <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary">Decision Maker</span>}
                </div>
              </div>
            ))}
            {!contactsLoading && contactList.length === 0 && <p className="text-xs text-muted">No contacts found</p>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Opportunities</h3>
          <div className="space-y-3">
            {oppsLoading && <p className="text-xs text-muted">Loading opportunities...</p>}
            {!oppsLoading && oppList.map((o: any) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 hover:bg-background transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{o.title}</p>
                  <p className="text-xs text-muted">{(o.stage || "").replace(/_/g, " ")} · {o.owner?.name || "Unassigned"}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(o.value || 0, "USD")}</span>
              </Link>
            ))}
            {!oppsLoading && oppList.length === 0 && <p className="text-xs text-muted">No opportunities</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
