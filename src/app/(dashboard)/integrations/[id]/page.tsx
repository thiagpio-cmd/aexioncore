"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi, apiPost, apiPut } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { Modal } from "@/components/shared/modal";
import { HealthStatusBadge } from "@/components/integrations/health-status";
import { formatRelativeTime } from "@/lib/utils";

// ─── Static Metadata ────────────────────────────────────────────────────────

const INTEGRATION_ICONS: Record<string, string> = {
  gmail: "📧", "google-calendar": "📆", outlook: "📨", slack: "💬",
  twilio: "📞", hubspot: "🔶", salesforce: "☁️", zapier: "⚡",
  stripe: "💳", calendly: "📅", zoom: "🎥", teams: "👥", jira: "📋",
  whatsapp: "💬",
};

const INTEGRATION_CATEGORIES: Record<string, string> = {
  gmail: "Email", "google-calendar": "Calendar", outlook: "Email + Calendar",
  slack: "Chat + Alerts", twilio: "Phone + SMS", hubspot: "CRM",
  salesforce: "CRM", zapier: "Automation", stripe: "Payments",
  calendly: "Scheduling", zoom: "Meetings", teams: "Meetings", jira: "Projects",
  whatsapp: "Messaging",
};

/** Only these slugs have real provider implementations with actual OAuth + sync */
const REAL_PROVIDER_SLUGS = new Set(["gmail", "google-calendar"]);

const EVENT_STATUS_COLORS: Record<string, string> = {
  matched: "bg-emerald-100 text-emerald-700",
  unmatched: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  processed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

interface HealthData {
  status: string;
  healthPercent: number;
  message: string;
  lastSuccessfulSync: string | null;
}

interface CredentialInfo {
  maskedToken?: string;
  expiresAt?: string;
  connectedEmail?: string;
}

interface RevenueEvent {
  id: string;
  eventType: string;
  entityType?: string;
  entityName?: string;
  amount?: number;
  currency?: string;
  resolvedEntityId?: string;
  resolutionMethod?: string;
  createdAt: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const integrationId = params.id as string;
  const { toastSuccess, toastError } = useToast();

  const { data: integration, loading, refetch } = useApi<any>(`/api/integrations/${integrationId}`);
  const { data: healthData } = useApi<HealthData>(`/api/integrations/${integrationId}/health`);
  const { data: revenueEvents } = useApi<RevenueEvent[]>(`/api/integrations/${integrationId}/events`);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [disconnectModal, setDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (loading) return <DetailSkeleton />;

  if (!integration) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Integration not found</p>
        <Link href="/integrations" className="mt-2 text-primary text-sm hover:underline">
          Back to Integrations
        </Link>
      </div>
    );
  }

  const providerKey = integration.providerKey || integration.slug;
  const isComingSoon = !REAL_PROVIDER_SLUGS.has(providerKey);

  if (isComingSoon) {
    return (
      <div>
        <Link href="/integrations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6" /></svg>
          Back to Integrations
        </Link>
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-foreground/5 text-4xl grayscale mb-6">
            {INTEGRATION_ICONS[integration.slug] || "🔗"}
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{integration.name}</h1>
          <span className="mb-4 inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted">
            Coming Soon
          </span>
          <p className="max-w-md text-sm text-muted">
            The {integration.name} integration is not yet available. We are working on bringing
            this integration to Aexion Core. Check back soon for updates.
          </p>
          <Link
            href="/integrations"
            className="mt-6 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-background transition-colors"
          >
            View All Integrations
          </Link>
        </div>
      </div>
    );
  }

  const webhooks = integration.webhooks || [];
  const isConnected = integration.status.toLowerCase() === "connected";
  const credential: CredentialInfo | null = integration.credential || null;
  const events = revenueEvents || [];
  const healthPct = healthData?.healthPercent ?? integration.healthPercent ?? 0;
  const healthStatus = healthData?.status || (isConnected ? "healthy" : "misconfigured");

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const { data, error } = await apiPost<{ message?: string }>(
      `/api/integrations/${integrationId}/sync`,
      {}
    );
    setSyncing(false);
    if (error) {
      setSyncResult({ success: false, message: error });
      toastError(error);
    } else {
      const msg = data?.message || "Sync completed successfully";
      setSyncResult({ success: true, message: msg });
      toastSuccess(msg);
      refetch();
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const { error } = await apiPost(`/api/integrations/${integrationId}/disconnect`, {});
    setDisconnecting(false);
    setDisconnectModal(false);
    if (error) {
      toastError(error);
      return;
    }
    toastSuccess("Integration disconnected");
    router.push("/integrations");
  };

  const handleReconnect = async () => {
    const { data: connectData, error } = await apiPost<{ authorizationUrl?: string }>(
      `/api/integrations/connect`,
      { providerKey }
    );
    if (error) {
      toastError(`Failed to reconnect: ${error}`);
      return;
    }
    if (connectData?.authorizationUrl) {
      window.location.href = connectData.authorizationUrl;
    }
  };

  return (
    <div>
      {/* Back link */}
      <Link href="/integrations" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6" /></svg>
        Integrations
      </Link>

      {/* ─── HEADER CARD ─────────────────────────────────────────────── */}
      <div className={`mb-8 rounded-2xl border p-6 ${
        isConnected
          ? "border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-surface"
          : "border-border bg-surface"
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${
              isConnected ? "bg-emerald-100" : "bg-primary/10"
            }`}>
              {INTEGRATION_ICONS[integration.slug] || "🔗"}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">{integration.name}</h1>
                <HealthStatusBadge status={healthStatus} />
              </div>
              <p className="mt-0.5 text-sm text-muted">{INTEGRATION_CATEGORIES[integration.slug] || integration.description || integration.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-background transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                    Sync Now
                  </>
                )}
              </button>
            )}
            {isConnected ? (
              <button
                onClick={() => setDisconnectModal(true)}
                className="rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleReconnect}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover shadow-sm transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div
          className={`mb-6 flex items-center justify-between rounded-xl border px-5 py-3 ${
            syncResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{syncResult.success ? "✓" : "!"}</span>
            <p className="text-sm font-medium">{syncResult.message}</p>
          </div>
          <button
            onClick={() => setSyncResult(null)}
            className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── STATS ROW ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Connection"
          value={isConnected ? "Active" : "Disconnected"}
          indicator={isConnected ? "emerald" : "red"}
        />
        <StatCard
          label="Health Score"
          value={`${healthPct}%`}
          indicator={healthPct >= 80 ? "emerald" : healthPct >= 50 ? "yellow" : "red"}
          bar={healthPct}
        />
        <StatCard
          label="Data Synced"
          value={(integration.itemsPersisted ?? 0).toLocaleString()}
          sub={`${(integration.itemsFetched ?? 0).toLocaleString()} fetched`}
        />
        <StatCard
          label="Last Sync"
          value={integration.lastSync ? formatRelativeTime(integration.lastSync) : "Never"}
          sub={integration.lastSync ? new Date(integration.lastSync).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── MAIN CONTENT (2/3) ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Sync History / Errors */}
          {(integration.lastError || (integration.errorCount ?? 0) > 0) && (
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-5">
              <h3 className="mb-3 text-sm font-semibold text-danger">Recent Errors</h3>
              <div className="space-y-2">
                {integration.lastError && (
                  <div className="rounded-lg bg-surface border border-danger/10 px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-danger">Last Error</span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        {integration.errorCount ?? 1} total
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{integration.lastError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revenue Events Feed */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Sync Activity</h3>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                </div>
                <p className="text-sm text-muted">No sync activity recorded yet</p>
                {isConnected && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="mt-3 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Run first sync
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="relative flex gap-4 pl-8">
                      <div className="absolute left-[7px] top-2 h-2.5 w-2.5 rounded-full border-2 border-primary bg-surface" />
                      <div className="flex-1 rounded-lg border border-border bg-background px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground font-mono">{event.eventType}</span>
                          <span className="text-xs text-muted">
                            {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {event.entityType && (
                            <span className="text-xs text-muted">
                              {event.entityType}{event.entityName ? `: ${event.entityName}` : ""}
                            </span>
                          )}
                          {event.amount != null && (
                            <span className="text-xs font-semibold text-foreground">
                              {event.currency || "USD"} {event.amount.toLocaleString()}
                            </span>
                          )}
                          {event.resolvedEntityId ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EVENT_STATUS_COLORS.matched}`}>
                              Resolved ({event.resolutionMethod || "auto"})
                            </span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EVENT_STATUS_COLORS.unmatched}`}>
                              Unresolved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Webhook Events */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Recent Webhook Events</h3>
            {webhooks.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No webhook events received yet</p>
            ) : (
              <div className="space-y-2">
                {webhooks.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[event.status] || "bg-gray-100 text-gray-600"}`}>
                        {event.status}
                      </span>
                      <span className="text-sm font-medium text-foreground font-mono">{event.eventType}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {event.retryCount > 0 && (
                        <span className="text-xs text-warning">{event.retryCount} retries</span>
                      )}
                      <span className="text-xs text-muted">
                        {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── SIDEBAR (1/3) ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Connection Status Card */}
          <div className={`rounded-xl border p-5 ${
            isConnected
              ? "border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-surface"
              : "border-border bg-surface"
          }`}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Connection Status</h3>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`h-3 w-3 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-400"}`} />
              <span className={`text-sm font-semibold ${isConnected ? "text-emerald-700" : "text-red-600"}`}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* Health bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted">Health Score</span>
                <span className="text-xs font-semibold text-foreground">{healthPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    healthPct >= 80 ? "bg-emerald-500" : healthPct >= 50 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${healthPct}%` }}
                />
              </div>
            </div>

            {healthData?.message && (
              <p className="text-[11px] text-muted mb-3">{healthData.message}</p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Last Successful Sync</span>
              <span className="text-xs font-medium text-foreground">
                {healthData?.lastSuccessfulSync
                  ? formatRelativeTime(healthData.lastSuccessfulSync)
                  : integration.lastSync
                    ? formatRelativeTime(integration.lastSync)
                    : "Never"}
              </span>
            </div>
          </div>

          {/* Credential Info */}
          {credential && isConnected && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Account</h3>
              <dl className="space-y-3">
                {credential.connectedEmail && (
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted">Email</dt>
                    <dd className="text-sm font-medium text-foreground">{credential.connectedEmail}</dd>
                  </div>
                )}
                {credential.maskedToken && (
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted">Token</dt>
                    <dd className="text-sm font-mono text-muted">{credential.maskedToken}</dd>
                  </div>
                )}
                {credential.expiresAt && (
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted">Expires</dt>
                    <dd className={`text-sm font-medium ${new Date(credential.expiresAt) < new Date() ? "text-danger" : "text-foreground"}`}>
                      {new Date(credential.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Data Summary */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Data Summary</h3>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted">Items Fetched</dt>
                <dd className="text-sm font-semibold text-foreground">{(integration.itemsFetched ?? 0).toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted">Items Synced</dt>
                <dd className="text-sm font-semibold text-emerald-600">{(integration.itemsPersisted ?? 0).toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted">Failed</dt>
                <dd className={`text-sm font-semibold ${(integration.itemsFailed ?? 0) > 0 ? "text-danger" : "text-foreground"}`}>
                  {(integration.itemsFailed ?? 0).toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted">Events Received</dt>
                <dd className="text-sm font-semibold text-foreground">{(integration.eventsReceived ?? 0).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Configuration */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Configuration</h3>
            <dl className="space-y-3">
              {[
                { label: "Provider", value: providerKey },
                { label: "Status", value: integration.status },
                { label: "Created", value: new Date(integration.createdAt).toLocaleDateString() },
                { label: "Updated", value: new Date(integration.updatedAt).toLocaleDateString() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Supported Events */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Supported Events</h3>
            <div className="space-y-1.5">
              {getSupportedEvents(integration.slug).map((event: string) => (
                <div key={event} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-foreground font-mono">{event}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Webhook URL</h3>
            <div className="rounded-lg bg-background p-3">
              <code className="text-xs text-muted break-all">
                /api/webhooks/{integration.slug}
              </code>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Configure this URL in your integration&apos;s webhook settings to receive events.
            </p>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      <Modal
        open={disconnectModal}
        onClose={() => setDisconnectModal(false)}
        title={`Disconnect ${integration.name}?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This will revoke access tokens and stop all data syncing from {integration.name}.
            You can reconnect at any time, but existing sync state may be lost.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDisconnectModal(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  indicator,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  indicator?: "emerald" | "yellow" | "red";
  bar?: number;
}) {
  const indicatorColors = {
    emerald: "bg-emerald-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };
  const valueColors = {
    emerald: "text-emerald-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {indicator && (
          <span className={`h-2 w-2 rounded-full ${indicatorColors[indicator]}`} />
        )}
        <p className={`text-lg font-bold ${indicator ? valueColors[indicator] : "text-foreground"}`}>
          {value}
        </p>
      </div>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-background overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              bar >= 80 ? "bg-emerald-500" : bar >= 50 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSupportedEvents(slug: string): string[] {
  const events: Record<string, string[]> = {
    gmail: ["message.received", "message.sent", "thread.updated"],
    "google-calendar": ["event.created", "event.updated", "event.deleted", "event.reminder"],
    outlook: ["email.received", "email.sent", "calendar.event"],
    whatsapp: ["message.received", "message.delivered", "message.read"],
    slack: ["message", "reaction_added", "channel_created"],
    hubspot: ["contact.created", "deal.updated", "deal.closed"],
    salesforce: ["lead.created", "opportunity.updated", "account.merged"],
    stripe: ["payment.succeeded", "subscription.created", "invoice.paid"],
    calendly: ["invitee.created", "invitee.canceled"],
    zoom: ["meeting.started", "meeting.ended", "recording.completed"],
    teams: ["call.started", "call.ended", "message.received"],
    jira: ["issue.created", "issue.updated", "sprint.completed"],
    zapier: ["zap.triggered", "zap.completed"],
  };
  return events[slug] || ["event.received"];
}
