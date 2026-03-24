"use client";

import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { getInitials } from "@/lib/utils";

export default function TeamPage() {
  const { data: teams, loading: teamsLoading } = useApi<any[]>("/api/teams");
  const { data: users, loading: usersLoading } = useApi<any[]>("/api/users");

  const loading = teamsLoading || usersLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" subtitle="Loading..." />
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted">Loading team data...</div>
        </div>
      </div>
    );
  }

  const teamList = teams || [];
  const userList = users || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Team" subtitle={`${userList.length} members · ${teamList.length} teams`} />

      {/* Teams */}
      <div className="grid grid-cols-2 gap-4">
        {teamList.map((team: any) => {
          const members = team.users || [];
          const manager = team.manager;
          return (
            <div key={team.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">{team.name}</h3>
                <span className="text-xs text-muted">{members.length} members</span>
              </div>
              {manager && <p className="text-xs text-muted mb-3">Manager: {manager.name}</p>}
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary-light text-[10px] font-semibold text-primary" title={m.name}>
                    {getInitials(m.name)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {teamList.length === 0 && <p className="text-sm text-muted col-span-2">No teams found</p>}
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-border"><h2 className="text-sm font-semibold text-foreground">All Members</h2></div>
        <table className="w-full">
          <thead><tr className="border-b border-border bg-background/50">
            <th className="px-6 py-3 text-left text-xs font-medium text-muted">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted">Team</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {userList.map((r: any) => (
              <tr key={r.id} className="hover:bg-background/30 transition-colors">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">{getInitials(r.name)}</div>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-sm text-muted">{r.email}</td>
                <td className="px-6 py-3.5"><span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">{r.role}</span></td>
                <td className="px-6 py-3.5 text-sm text-muted">{r.team?.name || "No team"}</td>
              </tr>
            ))}
            {userList.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-xs text-muted">No members found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
