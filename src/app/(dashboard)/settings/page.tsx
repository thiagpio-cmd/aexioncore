"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApi, apiPost, apiPatch } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "organization" | "members" | "security" | "notifications" | "audit";

const ROLE_BADGES: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  DIRECTOR: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  REVOPS: "bg-indigo-100 text-indigo-700",
  CLOSER: "bg-amber-100 text-amber-700",
  SDR: "bg-emerald-100 text-emerald-700",
  USER: "bg-gray-100 text-gray-700",
  VIEWER: "bg-gray-100 text-gray-500",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [tab, setTab] = useState<SettingsTab>("profile");

  const { data: members } = useApi<any[]>("/api/users");
  const { data: auditLogs } = useApi<any[]>("/api/audit-logs?limit=20");

  // Profile form state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileTimezone, setProfileTimezone] = useState("America/Sao_Paulo (BRT)");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<Record<string, { email: boolean; push: boolean }>>({
    "New lead assigned": { email: true, push: true },
    "Deal stage change": { email: true, push: false },
    "Task due reminder": { email: true, push: true },
    "New inbox message": { email: false, push: true },
    "Weekly summary": { email: true, push: false },
    "Overdue task alert": { email: true, push: true },
  });

  // Load notification prefs from DB on mount
  useEffect(() => {
    async function loadNotifPrefs() {
      try {
        const res = await fetch("/api/users/notifications");
        const json = await res.json();
        if (json.success && json.data?.notificationPrefs) {
          const saved = typeof json.data.notificationPrefs === "string"
            ? JSON.parse(json.data.notificationPrefs)
            : json.data.notificationPrefs;
          setNotifPrefs((prev) => ({ ...prev, ...saved }));
        }
      } catch {}
    }
    loadNotifPrefs();
  }, []);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
  }, [user?.name]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { data, error } = await apiPatch("/api/users/profile", {
        name: profileName,
      });
      if (error) {
        toastError(error);
      } else {
        toastSuccess("Profile settings saved");
      }
    } catch {
      toastError("Failed to save profile settings");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      toastError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toastError("Password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      const { data, error } = await apiPost("/api/users/password", {
        currentPassword,
        newPassword,
      });
      if (error) {
        toastError(error);
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toastSuccess("Password updated successfully");
      }
    } catch {
      toastError("Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      const { error } = await apiPatch("/api/users/notifications", {
        notificationPrefs: notifPrefs,
      });
      if (error) {
        toastError(error);
      } else {
        toastSuccess("Notification preferences saved");
      }
    } catch {
      toastError("Failed to save notification preferences");
    }
  };

  const toggleNotifPref = (label: string, channel: "email" | "push") => {
    setNotifPrefs((prev) => ({
      ...prev,
      [label]: { ...prev[label], [channel]: !prev[label][channel] },
    }));
  };

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: "profile", label: "Profile", icon: "Your personal settings" },
    { key: "organization", label: "Organization", icon: "Company settings" },
    { key: "members", label: "Members", icon: "Team management" },
    { key: "security", label: "Security", icon: "Authentication policies" },
    { key: "notifications", label: "Notifications", icon: "Alert preferences" },
    { key: "audit", label: "Audit Log", icon: "Activity history" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account and organization" />

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "w-full text-left rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:text-foreground hover:bg-background"
                )}
              >
                <div>{t.label}</div>
                <div className="text-[11px] font-normal opacity-70">{t.icon}</div>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === "profile" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Full Name</label>
                    <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
                    <input type="email" defaultValue={user?.email || ""} disabled className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Role</label>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGES[user?.role || "USER"]}`}>{user?.role}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Timezone</label>
                    <select value={profileTimezone} onChange={(e) => setProfileTimezone(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option>America/Sao_Paulo (BRT)</option>
                      <option>America/New_York (EST)</option>
                      <option>Europe/London (GMT)</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Change Password</h3>
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Current Password</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-danger">Passwords do not match</p>
                  )}
                </div>
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          )}

          {tab === "organization" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Organization Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Company Name</label>
                    <input type="text" defaultValue="Aexion Technologies" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Industry</label>
                    <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option>SaaS / Technology</option>
                      <option>Financial Services</option>
                      <option>Healthcare</option>
                      <option>E-commerce</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Default Currency</label>
                    <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option>BRL - Brazilian Real</option>
                      <option>USD - US Dollar</option>
                      <option>EUR - Euro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Fiscal Year Start</label>
                    <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                      <option>January</option>
                      <option>April</option>
                      <option>July</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => toastSuccess("Organization updated")}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
                >
                  Save Changes
                </button>
              </div>

              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Pipeline Configuration</h3>
                <p className="text-sm text-muted mb-4">Configure your default deal stages and probabilities</p>
                <div className="space-y-2">
                  {[
                    { stage: "Discovery", prob: "20%", color: "bg-blue-500" },
                    { stage: "Qualification", prob: "40%", color: "bg-indigo-500" },
                    { stage: "Proposal", prob: "60%", color: "bg-purple-500" },
                    { stage: "Negotiation", prob: "80%", color: "bg-amber-500" },
                    { stage: "Closed Won", prob: "100%", color: "bg-emerald-500" },
                    { stage: "Closed Lost", prob: "0%", color: "bg-red-500" },
                  ].map((s) => (
                    <div key={s.stage} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                      <div className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                      <span className="text-sm text-foreground flex-1">{s.stage}</span>
                      <span className="text-xs text-muted">Default: {s.prob}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "members" && (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-base font-semibold text-foreground">Team Members</h3>
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors">
                  Invite Member
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(members || []).map((m: any) => (
                    <tr key={m.id} className="hover:bg-background/30 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-foreground">{m.name}</td>
                      <td className="px-6 py-3 text-sm text-muted">{m.email}</td>
                      <td className="px-6 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGES[m.role] || "bg-gray-100 text-gray-600"}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="flex items-center gap-1 text-xs text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!members || members.length === 0) && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-muted">No team members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Authentication</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-xs text-muted">Add an extra layer of security to your account</p>
                    </div>
                    <button className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light transition-colors">
                      Enable
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Session Timeout</p>
                      <p className="text-xs text-muted">Auto-logout after inactivity</p>
                    </div>
                    <select className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none">
                      <option>30 days</option>
                      <option>7 days</option>
                      <option>24 hours</option>
                      <option>1 hour</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Password Policy</p>
                      <p className="text-xs text-muted">Minimum requirements for passwords</p>
                    </div>
                    <span className="text-xs text-muted">8+ chars, uppercase, number</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Active Sessions</h3>
                <div className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Current Session</p>
                      <p className="text-xs text-muted">macOS - Chrome - {new Date().toLocaleDateString()}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="rounded-xl border border-border bg-surface p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: "New lead assigned", desc: "When a lead is assigned to you" },
                  { label: "Deal stage change", desc: "When a deal moves to a new stage" },
                  { label: "Task due reminder", desc: "24h before a task is due" },
                  { label: "New inbox message", desc: "When you receive a new message" },
                  { label: "Weekly summary", desc: "Weekly performance report" },
                  { label: "Overdue task alert", desc: "When a task passes its due date" },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{n.label}</p>
                      <p className="text-xs text-muted">{n.desc}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifPrefs[n.label]?.email ?? false}
                          onChange={() => toggleNotifPref(n.label, "email")}
                          className="rounded border-border"
                        />
                        <span className="text-xs text-muted">Email</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifPrefs[n.label]?.push ?? false}
                          onChange={() => toggleNotifPref(n.label, "push")}
                          className="rounded border-border"
                        />
                        <span className="text-xs text-muted">Push</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveNotifications}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
              >
                Save Preferences
              </button>
            </div>
          )}

          {tab === "audit" && (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-semibold text-foreground">Recent Activity</h3>
                <p className="text-xs text-muted mt-0.5">System-wide audit trail of all changes</p>
              </div>
              {auditLogs && auditLogs.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-background/50">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Object</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-background/30">
                        <td className="px-6 py-3">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            log.action === "CREATE" ? "bg-emerald-100 text-emerald-700" :
                            log.action === "UPDATE" ? "bg-blue-100 text-blue-700" :
                            log.action === "DELETE" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-600"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-foreground">{log.objectType}</td>
                        <td className="px-6 py-3 text-sm text-muted">{log.user?.name || "System"}</td>
                        <td className="px-6 py-3 text-xs text-muted">{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-12 text-center text-sm text-muted">No audit logs available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
