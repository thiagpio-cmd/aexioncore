"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApi, apiPost, apiPut } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";
import { Modal } from "@/components/shared/modal";
import { HealthStatusBadge } from "@/components/integrations/health-status";
import { formatRelativeTime } from "@/lib/utils";

const INTEGRATION_ICONS: Record<string, string> = {
  gmail: "📧", outlook: "📨", whatsapp: "💬", slack: "💼",
  hubspot: "🔶", salesforce: "☁️", zapier: "⚡", stripe: "💳",
  calendly: "📅", zoom: "🎥", teams: "👥", jira: "📋",
};

const INTEGRATION_CATEGORIES: Record<string, string> = {
  gmail: "Communication", outlook: "Communication", whatsapp: "Communication",
  slack: "Communication", hubspot: "CRM", salesforce: "CRM",
  zapier: "Automation", stripe: "Payments", calendly: "Scheduling",
  zoom: "Meetings", teams: "Meetings", jira: "Project Management",
};

/** Only these slugs have real provider implementations with actual OAuth + sync */
const REAL_PROVIDER_SLUGS = new Set(["gmail"]);

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const { data, loading, refetch } = useApi<any[]>("/api/integrations");
  const { toastSuccess, toastError } = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [oauthModal, setOauthModal] = useState<any | null>(null);
  const [oauthStep, setOauthStep] = useState(0);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const items = data || [];

  // Handle OAuth redirect results from URL params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") {
      setBanner({ type: "success", message: "Integration connected successfully!" });
      toastSuccess("Integration connected successfully!");
      refetch();
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.pathname);
    } else if (error) {
      const msg = decodeURIComponent(error);
      setBanner({ type: "error", message: msg });
      toastError(msg);
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, refetch, toastSuccess, toastError]);

  const handleConnect = async (integration: any) => {
    const key = integration.providerKey || integration.slug;
    // Block connection attempts for integrations that have no real provider
    if (!REAL_PROVIDER_SLUGS.has(key)) {
      toastError(`${integration.name} integration is not yet available. Coming soon.`);
      return;
    }

    setConnecting(integration.id);

    // Try real OAuth flow via dynamic tenant endpoint
    const { data: connectData, error } = await apiPost<{ authorizationUrl?: string; integrationId?: string }>(
      `/api/integrations/connect`,
      { providerKey: key }
    );

    if (error) {
      setConnecting(null);
      toastError(`Failed to connect ${integration.name}: ${error}`);
      return;
    }

    if (connectData?.authorizationUrl) {
      // Real OAuth redirect
      window.location.href = connectData.authorizationUrl;
      return;
    }

    // No authorization URL returned — provider misconfigured
    setConnecting(null);
    toastError(`${integration.name} connection is not properly configured.`);
  };

  const handleOauthProceed = async () => {
    if (oauthStep < 2) {
      setOauthStep((prev) => prev + 1);
      return;
    }
    // Final step — actually connect
    if (!oauthModal) return;
    setConnecting(oauthModal.id);
    const { error } = await apiPut(`/api/integrations/${oauthModal.id}`, { status: "connected" });
    setConnecting(null);
    setOauthModal(null);
    setOauthStep(0);
    if (error) { toastError(error); return; }
    toastSuccess(`${oauthModal.name} connected successfully!`);
    refetch();
  };

  const [disconnectTarget, setDisconnectTarget] = useState<any | null>(null);

  const handleDisconnect = async (integration: any) => {
    setDisconnectTarget(integration);
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setConnecting(disconnectTarget.id);
    const { error } = await apiPost(`/api/integrations/${disconnectTarget.id}/disconnect`, {});
    setConnecting(null);
    setDisconnectTarget(null);
    if (error) { toastError(error); return; }
    toastSuccess(`${disconnectTarget.name} disconnected`);
    refetch();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" subtitle="Loading..." />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const connected = items.filter((i) => i.status.toLowerCase() === "connected");
  const disconnected = items.filter((i) => i.status.toLowerCase() !== "connected");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle={`${connected.length} connected · ${disconnected.length} available`}
      />

      {/* Success/Error Banners */}
      {banner && (
        <div
          className={`flex items-center justify-between rounded-xl border px-5 py-3 ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {banner.type === "success" ? "✓" : "!"}
            </span>
            <p className="text-sm font-medium">{banner.message}</p>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-surface px-5 py-3">
        <div>
          <span className="text-xs text-muted">Total Integrations</span>
          <p className="text-lg font-bold text-foreground">{items.length}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <span className="text-xs text-muted">Connected</span>
          <p className="text-lg font-bold text-success">{connected.length}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <span className="text-xs text-muted">Avg Health</span>
          <p className="text-lg font-bold text-foreground">
            {connected.length > 0 ? Math.round(connected.reduce((s: number, i: any) => s + (i.healthPercent || 0), 0) / connected.length) : 0}%
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <span className="text-xs text-muted">Total Events</span>
          <p className="text-lg font-bold text-foreground">
            {items.reduce((s: number, i: any) => s + (i.eventsReceived || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Connected Integrations */}
      {connected.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Connected</h2>
          <div className="grid grid-cols-3 gap-4">
            {connected.map((int) => (
              <div key={int.id} className="rounded-xl border border-border bg-surface p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{INTEGRATION_ICONS[int.slug] || "🔗"}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                      <p className="text-xs text-muted">{INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                    </div>
                  </div>
                  <HealthStatusBadge status={int.healthStatus || "healthy"} />
                </div>
                {/* Health percent bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted">Health</span>
                    <span className="text-[10px] font-semibold text-foreground">{int.healthPercent ?? 0}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (int.healthPercent ?? 0) >= 80
                          ? "bg-emerald-500"
                          : (int.healthPercent ?? 0) >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${int.healthPercent ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="rounded-lg bg-background px-2 py-1.5">
                    <p className="text-xs font-semibold text-foreground">{(int.itemsFetched ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted">Fetched</p>
                  </div>
                  <div className="rounded-lg bg-background px-2 py-1.5">
                    <p className="text-xs font-semibold text-success">{(int.itemsPersisted ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted">Synced</p>
                  </div>
                  <div className={`rounded-lg bg-background px-2 py-1.5 ${(int.itemsFailed ?? 0) > 0 ? "text-danger" : "text-foreground"}`}>
                    <p className="text-xs font-semibold">{int.itemsFailed ?? 0}</p>
                    <p className="text-[10px] text-muted">Failed</p>
                  </div>
                </div>
                {int.lastError && (
                  <div className="mb-3 rounded-lg border border-danger/20 bg-danger/5 p-2">
                    <p className="text-[10px] font-medium text-danger line-clamp-2" title={int.lastError}>
                      Warning: {int.lastError}
                    </p>
                  </div>
                )}
                {int.isConfigured === false && (
                  <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                    <p className="text-[10px] font-medium text-amber-600 line-clamp-2">
                      Warning: Platform admin removed OAuth credentials. Sync disabled.
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-muted mb-3">
                  Last sync: {int.lastSync ? formatRelativeTime(int.lastSync) : "Never"}
                </p>
                <div className="flex gap-2">
                  <Link href={`/integrations/${int.id}`} className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-background transition-colors">
                    Settings
                  </Link>
                  <button
                    onClick={() => handleDisconnect(int)}
                    disabled={connecting === int.id}
                    className="rounded-lg border border-danger px-3 py-2 text-xs font-medium text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
                  >
                    {connecting === int.id ? "..." : "Disconnect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      {disconnected.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Available</h2>
          <div className="grid grid-cols-3 gap-4">
            {disconnected.map((int) => (
              <div key={int.id} className="rounded-xl border border-border bg-surface p-5 opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{INTEGRATION_ICONS[int.slug] || "🔗"}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                      <p className="text-xs text-muted">{int.description || INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                    </div>
                  </div>
                  {REAL_PROVIDER_SLUGS.has(int.providerKey || int.slug) ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      Disconnected
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mb-4">
                  {getIntegrationDescription(int.slug)}
                </p>
                {REAL_PROVIDER_SLUGS.has(int.providerKey || int.slug) ? (
                  int.isConfigured === false ? (
                    <button
                      disabled
                      className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 transition-colors opacity-90 cursor-help"
                      title="Platform missing credentials. Check documentation."
                    >
                      Configuration Required
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(int)}
                      disabled={connecting === int.id}
                      className="w-full rounded-lg border border-primary bg-primary-light px-3 py-2 text-xs font-medium text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {connecting === int.id ? "Connecting..." : "Connect"}
                    </button>
                  )
                ) : (
                  <button
                    disabled
                    className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted cursor-not-allowed opacity-50"
                  >
                    Not Available Yet
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">No integrations available.</p>
        </div>
      )}

      {/* OAuth Flow Modal (fallback for integrations without real OAuth) */}
      <Modal
        open={!!oauthModal}
        onClose={() => { setOauthModal(null); setOauthStep(0); }}
        title={`Connect ${oauthModal?.name || ""}`}
      >
        {oauthModal && (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2">
              {["Authorize", "Permissions", "Complete"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i < oauthStep ? "bg-success text-white" : i === oauthStep ? "bg-primary text-white" : "bg-background text-muted border border-border"
                  }`}>
                    {i < oauthStep ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${i === oauthStep ? "text-foreground" : "text-muted"}`}>{step}</span>
                  {i < 2 && <div className={`w-8 h-0.5 ${i < oauthStep ? "bg-success" : "bg-border"}`} />}
                </div>
              ))}
            </div>

            {oauthStep === 0 && (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-background text-3xl">
                  {INTEGRATION_ICONS[oauthModal.slug] || "🔗"}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Authorize {oauthModal.name}</p>
                  <p className="text-xs text-muted mt-1">
                    Aexion Core will connect to your {oauthModal.name} account to sync data and automate workflows.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-left">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">This will allow Aexion to:</p>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    <li className="flex items-center gap-2"><span className="text-success">✓</span> Read your {oauthModal.name} data</li>
                    <li className="flex items-center gap-2"><span className="text-success">✓</span> Send data on your behalf</li>
                    <li className="flex items-center gap-2"><span className="text-success">✓</span> Receive real-time webhooks</li>
                  </ul>
                </div>
              </div>
            )}

            {oauthStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground text-center">Select permissions</p>
                <div className="space-y-2">
                  {[
                    { label: "Read contacts", desc: "Sync contact information", checked: true },
                    { label: "Send messages", desc: "Send emails/messages via integration", checked: true },
                    { label: "Sync calendar", desc: "Read and write calendar events", checked: true },
                    { label: "Webhooks", desc: "Receive real-time event notifications", checked: true },
                  ].map((perm) => (
                    <label key={perm.label} className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 cursor-pointer hover:bg-primary-light/30 transition-colors">
                      <input type="checkbox" defaultChecked={perm.checked} className="rounded border-border" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{perm.label}</p>
                        <p className="text-xs text-muted">{perm.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {oauthStep === 2 && (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to Connect!</p>
                  <p className="text-xs text-muted mt-1">
                    Click &ldquo;Complete Setup&rdquo; to finish connecting {oauthModal.name} to Aexion Core.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setOauthModal(null); setOauthStep(0); }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              {oauthStep > 0 && (
                <button
                  onClick={() => setOauthStep((prev) => prev - 1)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleOauthProceed}
                disabled={connecting === oauthModal.id}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {oauthStep === 2 ? (connecting === oauthModal.id ? "Connecting..." : "Complete Setup") : "Continue"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function getIntegrationDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    gmail: "Sync emails, track threads, and auto-log communication with contacts.",
    outlook: "Connect Microsoft Outlook for email sync and calendar integration.",
    whatsapp: "Send and receive WhatsApp messages directly from the CRM.",
    slack: "Get notifications and updates in your Slack workspace.",
    hubspot: "Bi-directional sync with HubSpot CRM data.",
    salesforce: "Import and export data with Salesforce.",
    zapier: "Connect with 5,000+ apps through Zapier automation.",
    stripe: "Track payments, subscriptions, and revenue data.",
    calendly: "Auto-schedule meetings and sync with your calendar.",
    zoom: "Launch and track Zoom meetings from opportunities.",
    teams: "Microsoft Teams integration for calls and meetings.",
    jira: "Sync tasks and issues with Jira projects.",
  };
  return descriptions[slug] || "Connect this integration to enhance your workflow.";
}
