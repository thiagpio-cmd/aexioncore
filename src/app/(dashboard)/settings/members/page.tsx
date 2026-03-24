"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { getInitials } from "@/lib/utils";

export default function SettingsMembersPage() {
  const { data: users, loading, error } = useApi<any[]>("/api/users");

  const userList = users || [];

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to Settings
      </Link>
      <PageHeader title="Members" subtitle={loading ? "Loading..." : `${userList.length} active members`} />

      {loading && (
        <div className="mt-4 flex items-center justify-center py-20">
          <div className="text-sm text-muted">Loading members...</div>
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
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Member</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Role</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Team</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-muted">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {userList.map((u: any) => (
                <tr key={u.id} className="hover:bg-background/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">{getInitials(u.name)}</div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">{u.role}</span></td>
                  <td className="px-5 py-3 text-sm text-muted">{u.team?.name || "No team"}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${u.isActive !== false ? "bg-success-light text-success" : "bg-background text-muted"}`}>{u.isActive !== false ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3 text-right">
                    <button className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors">Edit</button>
                  </td>
                </tr>
              ))}
              {userList.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-4 text-center text-xs text-muted">No members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
