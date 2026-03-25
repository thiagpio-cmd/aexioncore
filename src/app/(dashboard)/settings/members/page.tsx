"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, apiPost, apiPatch } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { useToast } from "@/components/shared/toast";
import { getInitials } from "@/lib/utils";
import { UserRole } from "@/types";

export default function SettingsMembersPage() {
  const { toastSuccess, toastError } = useToast();
  const { data: users, loading, error, refetch } = useApi<any[]>("/api/users");

  const [showInvite, setShowInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "SDR",
    workspace: "SDR",
  });

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ role: "", workspace: "" });

  const userList = users || [];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toastError("Name and email are required");
      return;
    }

    setSubmitting(true);
    const { error } = await apiPost("/api/users", {
      name: form.name,
      email: form.email,
      role: form.role,
      workspace: form.workspace,
    });
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess("Member added successfully");
    setShowInvite(false);
    setForm({ name: "", email: "", role: "SDR", workspace: "SDR" });
    refetch();
  }

  function openEdit(user: any) {
    setEditingUser(user);
    setEditForm({ role: user.role, workspace: user.workspace || "SDR" });
  }

  async function handleEditSave() {
    if (!editingUser) return;

    setSubmitting(true);
    const { error } = await apiPatch(`/api/users/${editingUser.id}`, {
      role: editForm.role,
      workspace: editForm.workspace,
    });
    setSubmitting(false);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess(`${editingUser.name} updated`);
    setEditingUser(null);
    refetch();
  }

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Back to Settings
      </Link>
      <PageHeader
        title="Members"
        subtitle={loading ? "Loading..." : `${userList.length} active members`}
        actions={
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            + Add Member
          </button>
        }
      />

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
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
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

      {/* Add Member Modal */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Add Member"
        description="Add a new team member to your organization"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <FormField label="Full Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="John Doe"
              className={inputStyles}
              autoFocus
            />
          </FormField>
          <FormField label="Email" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="john@company.com"
              className={inputStyles}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className={selectStyles}
              >
                {Object.values(UserRole).map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Workspace">
              <select
                value={form.workspace}
                onChange={(e) => setForm((prev) => ({ ...prev, workspace: e.target.value }))}
                className={selectStyles}
              >
                <option value="SDR">SDR</option>
                <option value="CLOSER">Closer</option>
                <option value="MANAGER">Manager</option>
                <option value="EXECUTIVE">Executive</option>
              </select>
            </FormField>
          </div>
          <p className="text-xs text-muted">
            A temporary password will be generated. The member can change it on first login.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit: ${editingUser?.name || ""}`}
        description="Update member role and workspace"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Role">
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                className={selectStyles}
              >
                {Object.values(UserRole).map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Workspace">
              <select
                value={editForm.workspace}
                onChange={(e) => setEditForm((prev) => ({ ...prev, workspace: e.target.value }))}
                className={selectStyles}
              >
                <option value="SDR">SDR</option>
                <option value="CLOSER">Closer</option>
                <option value="MANAGER">Manager</option>
                <option value="EXECUTIVE">Executive</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
