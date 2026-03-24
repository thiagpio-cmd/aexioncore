"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";

const actionIcons: Record<string, string> = {
  "lead.status_changed": "🔄",
  "opportunity.stage_changed": "📊",
  "approval.requested": "✋",
  "opportunity.closed_won": "🎉",
  "integration.synced": "🔗",
  "user.role_changed": "👤",
  "opportunity.reassigned": "↔️",
  "webhook.received": "📨",
};

export default function SettingsAuditPage() {
  const { data: logs, loading, error } = useApi<any[]>("/api/audit-logs");

  const logList = logs || [];

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to Settings
      </Link>
      <PageHeader title="Audit Log" subtitle={loading ? "Loading..." : `${logList.length} entries`} />

      {loading && (
        <div className="mt-4 flex items-center justify-center py-20">
          <div className="text-sm text-muted">Loading audit logs...</div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center justify-center py-20">
          <div className="text-sm text-muted">{error}</div>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4 rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-background/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Action</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Object</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Details</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Source</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Time</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {logList.map((log: any) => (
                <tr key={log.id} className="hover:bg-background/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{log.user?.name || "Unknown"}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <span>{actionIcons[log.action] || "📝"}</span>
                      <span className="font-mono text-xs">{log.action}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted">{log.objectName || `${log.objectType || ""}${log.objectId ? ` #${log.objectId}` : ""}`}</td>
                  <td className="px-5 py-3 text-xs text-muted max-w-xs truncate">{log.details}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted">{log.source}</span></td>
                  <td className="px-5 py-3 text-xs text-muted">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {logList.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-4 text-center text-xs text-muted">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
