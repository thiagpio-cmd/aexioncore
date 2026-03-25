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
const REAL_PROVIDER_SLUGS = new Set(["gmail", "google-calendar", "outlook", "slack", "twilio"]);

const COMING_SOON_ITEMS = [
  { slug: "hubspot",    name: "HubSpot",    description: "Bi-directional sync with HubSpot CRM contacts, deals, and pipelines." },
  { slug: "salesforce", name: "Salesforce",  description: "Import and export leads, opportunities, and accounts with Salesforce." },
  { slug: "zapier",     name: "Zapier",      description: "Connect with 5,000+ apps through Zapier automations." },
  { slug: "stripe",     name: "Stripe",      description: "Track payments, subscriptions, and revenue data in real time." },
  { slug: "calendly",   name: "Calendly",    description: "Auto-schedule meetings and sync availability with your calendar." },
  { slug: "zoom",       name: "Zoom",        description: "Launch and track Zoom meetings directly from opportunities." },
];

function getIntegrationDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    gmail: "Sync emails, track threads, and auto-log communication with contacts.",
    "google-calendar": "Sync calendar events, schedule meetings, and track availability.",
    outlook: "Connect Microsoft Outlook for email sync and calendar integration.",
    slack: "Get notifications, alerts, and updates in your Slack workspace.",
    twilio: "Send SMS, make calls, and log phone activity automatically.",
    whatsapp: "Send and receive WhatsApp messages directly from the CRM.",
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

function getFeatureTags(slug: string): string[] {
  const tags: Record<string, string[]> = {
    gmail: ["Email Sync", "Thread Tracking", "Auto-log"],
    "google-calendar": ["Event Sync", "Scheduling", "Availability"],
    outlook: ["Email", "Calendar", "Contacts"],
    slack: ["Notifications", "Alerts", "Channels"],
    twilio: ["SMS", "Phone Calls", "Voicemail"],
    whatsapp: ["Messages", "Media", "Templates"],
  };
  return tags[slug] || [];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const { data, loading, refetch } = useApi<any[]>("/api/integrations");
  const { toastSuccess, toastError } = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const items = data || [];

  // Handle OAuth redirect results from URL params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") {
      setBanner({ type: "success", message: "Integration connected successfully!" });
      toastSuccess("Integration connected successfully!");
      refetch();
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.pathname);
    } else if (error) {
      const msg = decodeURIComponent(error);
      setBanner({ type: "error", message: msg });
      toastError(msg);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, refetch, toastSuccess, toastError]);

  const handleConnect = async (integration: any) => {
    const key = integration.providerKey || integration.slug;
    if (!REAL_PROVIDER_SLUGS.has(key)) {
      toastError(`${integration.name} integration is not yet available. Coming soon.`);
      return;
    }

    setConnecting(integration.id);

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
      window.location.href = connectData.authorizationUrl;
      return;
    }

    // API key providers (like Twilio) connect immediately without redirect
    if ((connectData as any)?.connected) {
      setConnecting(null);
      toastSuccess(`${integration.name} connected successfully!`);
      refetch();
      return;
    }

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

  const handleNotifyMe = (slug: string) => {
    setNotified((prev) => new Set(prev).add(slug));
    toastSuccess("We'll notify you when this integration is available!");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" subtitle="Loading..." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Split items into connected vs disconnected (from API)
  const connectedItems = items.filter((i) => i.status.toLowerCase() === "connected");
  const disconnectedItems = items.filter((i) => i.status.toLowerCase() !== "connected");

  // Available = disconnected items that have real providers
  const availableItems = disconnectedItems.filter((i) => REAL_PROVIDER_SLUGS.has(i.providerKey || i.slug));

  // Coming soon = hardcoded list, minus anything already in the API response
  const existingSlugs = new Set(items.map((i) => i.providerKey || i.slug));
  const comingSoonItems = COMING_SOON_ITEMS.filter((cs) => !existingSlugs.has(cs.slug));
  // Also add API items that are disconnected and NOT real providers
  const comingSoonFromApi = disconnectedItems.filter((i) => !REAL_PROVIDER_SLUGS.has(i.providerKey || i.slug));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        subtitle="Connect your tools in one click"
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
            <span className="text-sm">{banner.type === "success" ? "✓" : "!"}</span>
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

      {/* ─── CONNECTED SECTION ───────────────────────────────────────── */}
      {connectedItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
              Connected
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              {connectedItems.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedItems.map((int) => (
              <div
                key={int.id}
                className="group relative rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-surface p-5 hover:shadow-md transition-all duration-200"
              >
                {/* Status indicator line */}
                <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-emerald-400" />

                <div className="flex items-start justify-between mb-4 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100/80 text-xl">
                      {INTEGRATION_ICONS[int.slug] || "🔗"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                      <p className="text-[11px] text-muted">{INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                    </div>
                  </div>
                  <HealthStatusBadge status={int.healthStatus || "healthy"} compact />
                </div>

                {/* Sync stats */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-medium text-emerald-700">Synced</span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {(int.itemsPersisted ?? 0).toLocaleString()} items
                  </span>
                  {(int.itemsFailed ?? 0) > 0 && (
                    <span className="text-[11px] text-danger font-medium">
                      {int.itemsFailed} failed
                    </span>
                  )}
                </div>

                {/* Last sync time */}
                <p className="text-[11px] text-muted mb-4">
                  Last sync: {int.lastSync ? formatRelativeTime(int.lastSync) : "Never"}
                </p>

                {/* Error banner */}
                {int.lastError && (
                  <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2">
                    <p className="text-[10px] font-medium text-danger line-clamp-1" title={int.lastError}>
                      {int.lastError}
                    </p>
                  </div>
                )}

                {/* Config warning */}
                {int.isConfigured === false && (
                  <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <p className="text-[10px] font-medium text-amber-600">
                      OAuth credentials removed. Sync disabled.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/integrations/${int.id}`}
                    className="flex-1 rounded-lg bg-foreground/5 px-3 py-2 text-center text-xs font-semibold text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    Manage
                  </Link>
                  <button
                    onClick={() => handleDisconnect(int)}
                    disabled={connecting === int.id}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50"
                  >
                    {connecting === int.id ? "..." : "Disconnect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── AVAILABLE SECTION ───────────────────────────────────────── */}
      {availableItems.length > 0 && (
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
              Available
            </h2>
            <span className="text-[11px] text-muted font-medium">Connect Now</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {availableItems.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableItems.map((int) => (
              <div
                key={int.id}
                className="group rounded-xl border border-border bg-surface p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl group-hover:scale-105 transition-transform">
                      {INTEGRATION_ICONS[int.slug] || "🔗"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                      <p className="text-[11px] text-primary font-medium">{INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted leading-relaxed mb-3">
                  {getIntegrationDescription(int.slug)}
                </p>

                {/* Feature tags */}
                {getFeatureTags(int.slug).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {getFeatureTags(int.slug).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {int.isConfigured === false ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-600 cursor-help"
                    title="Platform admin needs to configure OAuth credentials."
                  >
                    Configuration Required
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(int)}
                    disabled={connecting === int.id}
                    className="w-full rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-white hover:bg-primary-hover shadow-sm hover:shadow transition-all disabled:opacity-50"
                  >
                    {connecting === int.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Connecting...
                      </span>
                    ) : (
                      "Connect"
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── COMING SOON SECTION ─────────────────────────────────────── */}
      {(comingSoonItems.length > 0 || comingSoonFromApi.length > 0) && (
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-muted tracking-wide uppercase">
              Coming Soon
            </h2>
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-muted">
              {comingSoonItems.length + comingSoonFromApi.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Hardcoded coming soon */}
            {comingSoonItems.map((cs) => (
              <div
                key={cs.slug}
                className="rounded-xl border border-border/60 bg-surface/50 p-5 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 text-xl grayscale">
                      {INTEGRATION_ICONS[cs.slug] || "🔗"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground/80">{cs.name}</h3>
                      <p className="text-[11px] text-muted">{INTEGRATION_CATEGORIES[cs.slug] || "Integration"}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed mb-4">
                  {cs.description}
                </p>
                <button
                  onClick={() => handleNotifyMe(cs.slug)}
                  disabled={notified.has(cs.slug)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    notified.has(cs.slug)
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 cursor-default"
                      : "border-border bg-background text-muted hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  {notified.has(cs.slug) ? "Notified" : "Notify Me"}
                </button>
              </div>
            ))}

            {/* API-sourced coming soon (legacy seeded without real providers) */}
            {comingSoonFromApi.map((int) => (
              <div
                key={int.id}
                className="rounded-xl border border-border/60 bg-surface/50 p-5 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 text-xl grayscale">
                      {INTEGRATION_ICONS[int.slug] || "🔗"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground/80">{int.name}</h3>
                      <p className="text-[11px] text-muted">{INTEGRATION_CATEGORIES[int.slug] || "Integration"}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed mb-4">
                  {getIntegrationDescription(int.slug)}
                </p>
                <button
                  onClick={() => handleNotifyMe(int.slug)}
                  disabled={notified.has(int.slug)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    notified.has(int.slug)
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 cursor-default"
                      : "border-border bg-background text-muted hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  {notified.has(int.slug) ? "Notified" : "Notify Me"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && comingSoonItems.length === 0 && (
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
