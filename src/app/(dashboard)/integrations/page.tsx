"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApi, apiPost } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";
import { Modal } from "@/components/shared/modal";
import { HealthStatusBadge } from "@/components/integrations/health-status";
import { formatRelativeTime } from "@/lib/utils";

const INTEGRATION_ICONS: Record<string, string> = {
  gmail: "📧", "google-calendar": "📆", outlook: "📨", whatsapp: "💬", slack: "💼",
  hubspot: "🔶", salesforce: "☁️", zapier: "⚡", stripe: "💳",
  calendly: "📅", zoom: "🎥", teams: "👥", jira: "📋",
};

const INTEGRATION_CATEGORIES: Record<string, string> = {
  gmail: "Communication", "google-calendar": "Scheduling", outlook: "Communication",
  whatsapp: "Communication", slack: "Communication", hubspot: "CRM", salesforce: "CRM",
  zapier: "Automation", stripe: "Payments", calendly: "Scheduling",
  zoom: "Meetings", teams: "Meetings", jira: "Project Management",
};

/** Only these slugs have real provider implementations with actual OAuth + sync */
const REAL_PROVIDER_SLUGS = new Set(["gmail", "google-calendar"]);

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const { data, loading, refetch } = useApi<any[]>("/api/integrations");
  const { toastSuccess, toastError } = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);
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
        subtitle={`${connected.length} connected · ${disconnected.filter((i) => REAL_PROVIDER_SLUGS.has(i.providerKey || i.slug)).length} available`}
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
      {(() => {
        const available = disconnected.filter((i) => REAL_PROVIDER_SLUGS.has(i.providerKey || i.slug));
        const comingSoon = disconnected.filter((i) => !REAL_PROVIDER_SLUGS.has(i.providerKey || i.slug));
        return (
          <>
            {available.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">Available</h2>
                <div className="grid grid-cols-3 gap-4">
                  {available.map((int) => (
                    <div key={int.id} className="rounded-xl border border-border bg-surface p-5 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{INTEGRATION_ICONS[int.slug] || "🔗"}</span>
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                            <p className="text-xs text-muted">{int.description || INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary">
                          Ready
                        </span>
                      </div>
                      <p className="text-xs text-muted mb-4">
                        {getIntegrationDescription(int.slug)}
                      </p>
                      {int.isConfigured === false ? (
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comingSoon.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">Coming Soon</h2>
                <div className="grid grid-cols-3 gap-4">
                  {comingSoon.map((int) => (
                    <div key={int.id} className="rounded-xl border border-border bg-surface p-5 opacity-60">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl grayscale">{INTEGRATION_ICONS[int.slug] || "🔗"}</span>
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                            <p className="text-xs text-muted">{int.description || INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-medium text-muted">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-xs text-muted mb-4">
                        {getIntegrationDescription(int.slug)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">No integrations available.</p>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      <Modal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title={`Disconnect ${disconnectTarget?.name || ""}?`}
      >
        {disconnectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              This will revoke access tokens and stop all data syncing from {disconnectTarget.name}.
              You can reconnect at any time.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDisconnectTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                disabled={connecting === disconnectTarget.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {connecting === disconnectTarget.id ? "Disconnecting..." : "Disconnect"}
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
    "google-calendar": "Sync Google Calendar events, schedule meetings, and track availability.",
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
