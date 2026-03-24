"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";

const statusConfig: Record<string, { color: string; label: string }> = {
  processed: { color: "bg-success-light text-success", label: "Processed" },
  failed: { color: "bg-danger-light text-danger", label: "Failed" },
  queued: { color: "bg-warning-light text-warning", label: "Queued" },
};

export default function EventsPage() {
  const { data, loading } = useApi<any[]>("/api/webhook-events");
  const items = data || [];
  const [filter, setFilter] = useState("all");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Event Logs" subtitle="No events recorded" />
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">No webhook events found.</p>
        </div>
      </div>
    );
  }

  const filtered = filter === "all" ? items : items.filter((e) => e.status === filter);
  const processed = items.filter((e) => e.status === "processed").length;
  const failed = items.filter((e) => e.status === "failed").length;

  return (
    <div className="space-y-4">
      <PageHeader title="Event Logs" subtitle={`${items.length} events · ${processed} processed · ${failed} failed`} />
      <div className="flex gap-2">
        {["all", "processed", "failed", "queued"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors capitalize ${filter === f ? "bg-primary text-white" : "bg-surface border border-border text-muted"}`}>{f}</button>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-background/50">
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Type</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Connector</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Status</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Event Type</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Retries</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-muted">Time</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {filtered.map((evt) => {
              const sc = statusConfig[evt.status] || statusConfig.processed;
              return (
                <tr key={evt.id} className="hover:bg-background/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-foreground font-mono">{evt.eventType}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted">{evt.integration?.name || "—"}</td>
                  <td className="px-5 py-3.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.color}`}>{sc.label}</span></td>
                  <td className="px-5 py-3.5 text-sm text-muted">{evt.eventType}</td>
                  <td className="px-5 py-3.5 text-sm text-muted">{(evt.retryCount || 0) > 0 ? <span className="text-danger font-medium">{evt.retryCount}</span> : "0"}</td>
                  <td className="px-5 py-3.5 text-xs text-muted">{new Date(evt.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
