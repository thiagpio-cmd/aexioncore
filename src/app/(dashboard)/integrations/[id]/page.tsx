"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useApi, apiPost, apiPut } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { Modal } from "@/components/shared/modal";
import { HealthStatusBadge, HealthStatusCard } from "@/components/integrations/health-status";

const INTEGRATION_ICONS: Record<string, string> = {
  gmail: "📧", "google-calendar": "📆", outlook: "📨", whatsapp: "💬", slack: "💼",
  hubspot: "🔶", salesforce: "☁️", zapier: "⚡", stripe: "💳",
  calendly: "📅", zoom: "🎥", teams: "👥", jira: "📋",
};

/** Only these slugs have real provider implementations with actual OAuth + sync */
const REAL_PROVIDER_SLUGS = new Set(["gmail", "google-calendar"]);

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  processed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const EVENT_STATUS_COLORS: Record<string, string> = {
  matched: "bg-emerald-100 text-emerald-700",
  unmatched: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  error: "bg-red-100 text-red-700",
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

export default function IntegrationDetailPage() {
  const params = useParams();
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
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-background text-4xl grayscale mb-6">
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
    refetch();
  };

  const handleToggle = async () => {
    if (isConnected) {
      setDisconnectModal(true);
      return;
    }
    const newStatus = "connected";
    const { error } = await apiPut(`/api/integrations/${integrationId}`, { status: newStatus });
    if (error) { toastError(error); return; }
    toastSuccess("Integration connected");
    refetch();
  };

  return (
    <div>
      <Link href="/integrations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6" /></svg>
        Back to Integrations
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-2xl">
            {INTEGRATION_ICONS[integration.slug] || "🔗"}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{integration.name}</h1>
              <HealthStatusBadge status={healthData?.status || (isConnected ? "healthy" : "misconfigured")} />
            </div>
            <p className="mt-0.5 text-sm text-muted">{integration.description || integration.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          )}
          <button
            onClick={handleToggle}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isConnected
                ? "border border-danger text-danger hover:bg-danger-light"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </button>
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
          <p className="text-sm font-medium">{syncResult.message}</p>
          <button
            onClick={() => setSyncResult(null)}
            className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Health", value: `${healthData?.healthPercent ?? integration.healthPercent ?? 0}%`, color: (healthData?.healthPercent || integration.healthPercent || 0) >= 80 ? "text-success" : (healthData?.healthPercent || integration.healthPercent || 0) >= 50 ? "text-warning" : "text-danger" },
              { label: "Events Received", value: (integration.eventsReceived ?? 0).toLocaleString(), color: "text-foreground" },
              { label: "Error Count", value: (integration.errorCount ?? 0).toString(), color: (integration.errorCount || 0) > 0 ? "text-danger" : "text-foreground" },
              { label: "Last Sync", value: integration.lastSync ? new Date(integration.lastSync).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never", color: "text-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted mb-1">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Revenue Events Feed */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Revenue Events</h3>
            {events.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No revenue events recorded yet</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="relative flex gap-4 pl-8">
                      {/* Timeline dot */}
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
                          {event.resolvedEntityId && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EVENT_STATUS_COLORS.matched}`}>
                              Resolved ({event.resolutionMethod || "auto"})
                            </span>
                          )}
                          {!event.resolvedEntityId && (
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Health Status Card */}
          <HealthStatusCard
            status={healthData?.status || (isConnected ? "healthy" : "misconfigured")}
            healthPercent={healthData?.healthPercent ?? integration.healthPercent}
            lastSuccessfulSync={healthData?.lastSuccessfulSync || null}
          />

          {/* Health Message */}
          {healthData?.message && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Health Details</h3>
              <p className="text-xs text-muted">{healthData.message}</p>
            </div>
          )}

          {/* Credential Info */}
          {credential && isConnected && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Credential</h3>
              <dl className="space-y-3">
                {credential.connectedEmail && (
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted">Connected Email</dt>
                    <dd className="text-sm font-medium text-foreground">{credential.connectedEmail}</dd>
                  </div>
                )}
                {credential.maskedToken && (
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted">Token</dt>
                    <dd className="text-sm font-mono text-foreground">{credential.maskedToken}</dd>
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

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Configuration</h3>
            <dl className="space-y-3">
              {[
                { label: "Slug", value: integration.slug },
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

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Supported Events</h3>
            <div className="space-y-1.5">
              {getSupportedEvents(integration.slug).map((event: string) => (
                <div key={event} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-foreground">{event}</span>
                </div>
              ))}
            </div>
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
