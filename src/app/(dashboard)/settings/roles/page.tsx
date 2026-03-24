"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { UserRole } from "@/types";

const roles = [
  { role: UserRole.SDR, description: "Sales Development Representative — lead qualification and outreach", permissions: ["Leads (CRUD)", "Tasks (CRUD)", "Inbox (Read/Send)", "Meetings (Read)", "Own Performance"] },
  { role: UserRole.CLOSER, description: "Account Executive — deal management and closing", permissions: ["Opportunities (CRUD)", "Pipeline (Full)", "Proposals (CRUD)", "Forecast (Own)", "Accounts (Read)"] },
  { role: UserRole.MANAGER, description: "Sales Manager — team oversight and coaching", permissions: ["Team Performance", "Pipeline Control", "Forecast (Team)", "Coaching Center", "Deal Review", "Approvals"] },
  { role: UserRole.DIRECTOR, description: "Sales Director — strategic oversight and revenue", permissions: ["Revenue Dashboard", "Forecast (All)", "Segment Analysis", "Team Risk", "Strategic Insights"] },
  { role: UserRole.ADMIN, description: "System Administrator — full access", permissions: ["All Modules", "Settings", "Integrations", "Audit Logs", "User Management", "Billing"] },
  { role: UserRole.REVOPS, description: "Revenue Operations — process and data management", permissions: ["Dashboards", "Integrations", "Settings", "Custom Fields", "Pipeline Config", "Audit"] },
  { role: UserRole.VIEWER, description: "Read-only access to assigned data", permissions: ["Dashboards (Read)", "Reports (Read)", "Pipeline (Read)"] },
];

export default function SettingsRolesPage() {
  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to Settings
      </Link>
      <PageHeader title="Roles & Permissions" subtitle={`${roles.length} roles configured`} />
      <div className="mt-4 space-y-4">
        {roles.map((r) => (
          <div key={r.role} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{r.role}</h3>
                <p className="text-xs text-muted mt-0.5">{r.description}</p>
              </div>
              <button className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors">Edit</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.permissions.map((p) => (
                <span key={p} className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted">{p}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
