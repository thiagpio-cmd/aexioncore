"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Modal, FormField, inputStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { UserRole } from "@/types";

const ALL_PERMISSIONS = [
  "Leads (CRUD)",
  "Tasks (CRUD)",
  "Inbox (Read/Send)",
  "Meetings (Read)",
  "Own Performance",
  "Opportunities (CRUD)",
  "Pipeline (Full)",
  "Proposals (CRUD)",
  "Forecast (Own)",
  "Accounts (Read)",
  "Team Performance",
  "Pipeline Control",
  "Forecast (Team)",
  "Coaching Center",
  "Deal Review",
  "Approvals",
  "Revenue Dashboard",
  "Forecast (All)",
  "Segment Analysis",
  "Team Risk",
  "Strategic Insights",
  "All Modules",
  "Settings",
  "Integrations",
  "Audit Logs",
  "User Management",
  "Billing",
  "Dashboards",
  "Custom Fields",
  "Pipeline Config",
  "Audit",
  "Dashboards (Read)",
  "Reports (Read)",
  "Pipeline (Read)",
];

type RoleDef = {
  role: UserRole;
  description: string;
  permissions: string[];
};

const defaultRoles: RoleDef[] = [
  { role: UserRole.SDR, description: "Sales Development Representative — lead qualification and outreach", permissions: ["Leads (CRUD)", "Tasks (CRUD)", "Inbox (Read/Send)", "Meetings (Read)", "Own Performance"] },
  { role: UserRole.CLOSER, description: "Account Executive — deal management and closing", permissions: ["Opportunities (CRUD)", "Pipeline (Full)", "Proposals (CRUD)", "Forecast (Own)", "Accounts (Read)"] },
  { role: UserRole.MANAGER, description: "Sales Manager — team oversight and coaching", permissions: ["Team Performance", "Pipeline Control", "Forecast (Team)", "Coaching Center", "Deal Review", "Approvals"] },
  { role: UserRole.DIRECTOR, description: "Sales Director — strategic oversight and revenue", permissions: ["Revenue Dashboard", "Forecast (All)", "Segment Analysis", "Team Risk", "Strategic Insights"] },
  { role: UserRole.ADMIN, description: "System Administrator — full access", permissions: ["All Modules", "Settings", "Integrations", "Audit Logs", "User Management", "Billing"] },
  { role: UserRole.REVOPS, description: "Revenue Operations — process and data management", permissions: ["Dashboards", "Integrations", "Settings", "Custom Fields", "Pipeline Config", "Audit"] },
  { role: UserRole.VIEWER, description: "Read-only access to assigned data", permissions: ["Dashboards (Read)", "Reports (Read)", "Pipeline (Read)"] },
];

export default function SettingsRolesPage() {
  const { toastSuccess } = useToast();
  const [roles, setRoles] = useState<RoleDef[]>(defaultRoles);
  const [editingRole, setEditingRole] = useState<RoleDef | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());

  function openEdit(role: RoleDef) {
    setEditingRole(role);
    setEditDescription(role.description);
    setEditPermissions(new Set(role.permissions));
  }

  function togglePermission(perm: string) {
    setEditPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  }

  function handleSave() {
    if (!editingRole) return;

    setRoles((prev) =>
      prev.map((r) =>
        r.role === editingRole.role
          ? { ...r, description: editDescription, permissions: Array.from(editPermissions) }
          : r
      )
    );

    toastSuccess(`${editingRole.role} role updated`);
    setEditingRole(null);
  }

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
              <button
                onClick={() => openEdit(r)}
                className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
              >
                Edit
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.permissions.map((p) => (
                <span key={p} className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted">{p}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={`Edit Role: ${editingRole?.role || ""}`}
        description="Update role description and toggle permissions"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <FormField label="Description">
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className={inputStyles}
            />
          </FormField>

          <FormField label="Permissions">
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editPermissions.has(perm)}
                    onChange={() => togglePermission(perm)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted group-hover:text-foreground transition-colors">{perm}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingRole(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
