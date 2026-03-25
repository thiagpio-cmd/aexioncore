"use client";

import { useState } from "react";
import { useApi, apiPut, apiPost } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

interface ProviderStatus {
  key: string;
  name: string;
  fields: ProviderField[];
  redirectUri: string | null;
  docsUrl: string;
  setupSteps: string[];
  hasDbConfig: boolean;
  hasEnvVars: boolean;
  isConfigured: boolean;
  maskedClientId: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SettingsIntegrationsPage() {
  const { data, loading, refetch } = useApi<ProviderStatus[]>("/api/settings/integrations");
  const { toastSuccess, toastError } = useToast();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const providers = data || [];

  const toggle = (key: string) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  const getFieldValue = (providerKey: string, fieldKey: string): string => {
    return formData[providerKey]?.[fieldKey] ?? "";
  };

  const setFieldValue = (providerKey: string, fieldKey: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [fieldKey]: value,
      },
    }));
  };

  const handleSave = async (provider: ProviderStatus) => {
    const credentials = formData[provider.key];
    if (!credentials?.clientId || !credentials?.clientSecret) {
      toastError("Client ID and Client Secret are required");
      return;
    }

    setSaving(provider.key);
    const { error } = await apiPut("/api/settings/integrations", {
      provider: provider.key,
      credentials,
    });
    setSaving(null);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess(`${provider.name} credentials saved successfully`);
    // Clear the form values after save
    setFormData((prev) => {
      const next = { ...prev };
      delete next[provider.key];
      return next;
    });
    refetch();
  };

  const handleTest = async (provider: ProviderStatus) => {
    // Test by attempting a connect handshake (just checks config validity)
    setTesting(provider.key);
    const { data: result, error } = await apiPost<{ authorizationUrl?: string }>(
      "/api/integrations/connect",
      { providerKey: provider.key, testOnly: true }
    );
    setTesting(null);

    if (error) {
      toastError(`Test failed: ${error}`);
      return;
    }

    if (result?.authorizationUrl) {
      toastSuccess(`${provider.name} configuration is valid. OAuth URL generated successfully.`);
    } else {
      toastSuccess(`${provider.name} configuration is valid.`);
    }
  };

  const handleRemove = async (provider: ProviderStatus) => {
    setSaving(provider.key);
    // Save empty credentials to effectively remove — the API will overwrite
    const { error } = await apiPut("/api/settings/integrations", {
      provider: provider.key,
      credentials: { clientId: "REMOVED", clientSecret: "REMOVED" },
    });
    setSaving(null);

    if (error) {
      toastError(error);
      return;
    }

    toastSuccess(`${provider.name} credentials removed`);
    refetch();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integration Settings" subtitle="Loading..." />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Integration Settings"
        subtitle="Configure OAuth credentials for each provider. Your team members can then connect integrations with one click."
      />

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
        <p className="text-sm text-blue-800">
          Credentials are encrypted at rest. Each provider requires its own OAuth app or API keys.
          Environment variables (if set) are used as fallback when no custom config is saved.
        </p>
      </div>

      {/* Provider sections */}
      <div className="space-y-3">
        {providers.map((provider) => {
          const isExpanded = expanded === provider.key;
          const isSaving = saving === provider.key;
          const isTesting = testing === provider.key;
          const hasFormValues = !!(formData[provider.key]?.clientId || formData[provider.key]?.clientSecret);

          return (
            <div
              key={provider.key}
              className={`rounded-xl border transition-all duration-200 ${
                isExpanded
                  ? "border-primary/30 shadow-sm"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              {/* Header (collapsible) */}
              <button
                onClick={() => toggle(provider.key)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 text-lg">
                    {getProviderIcon(provider.key)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {provider.name}
                    </h3>
                    <p className="text-[11px] text-muted">
                      {provider.isConfigured
                        ? provider.hasDbConfig
                          ? "Custom credentials configured"
                          : "Using environment variables"
                        : "Not configured"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status badge */}
                  <StatusBadge provider={provider} />

                  {/* Chevron */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-muted transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border px-5 py-5 space-y-5">
                  {/* Setup guide */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                      Setup Guide
                    </h4>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      {provider.setupSteps.map((step, i) => (
                        <li key={i} className="text-xs text-muted leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-primary font-medium hover:underline"
                    >
                      Open Developer Console
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>

                  {/* Redirect URI */}
                  {provider.redirectUri && (
                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">
                        Redirect URI
                      </h4>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono select-all">
                          {provider.redirectUri}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(provider.redirectUri!);
                            toastSuccess("Redirect URI copied");
                          }}
                          className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-foreground transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-[10px] text-muted mt-1">
                        Add this URL to your OAuth app&apos;s authorized redirect URIs.
                      </p>
                    </div>
                  )}

                  {/* Credential fields */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
                      Credentials
                    </h4>

                    {provider.hasDbConfig && !hasFormValues && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <p className="text-xs text-emerald-700 font-medium">
                              Custom credentials saved
                              {provider.maskedClientId && (
                                <span className="text-emerald-600 font-normal ml-1">
                                  (Client ID: {provider.maskedClientId})
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemove(provider)}
                            disabled={isSaving}
                            className="text-[10px] text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                          >
                            {isSaving ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    )}

                    {provider.hasEnvVars && !provider.hasDbConfig && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
                        <p className="text-xs text-amber-700">
                          Using platform environment variables. Save custom credentials below to override.
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {provider.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            {field.label}
                          </label>
                          <div className="relative">
                            <input
                              type={field.secret && !showSecrets[provider.key] ? "password" : "text"}
                              placeholder={field.placeholder}
                              value={getFieldValue(provider.key, field.key)}
                              onChange={(e) =>
                                setFieldValue(provider.key, field.key, e.target.value)
                              }
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                            />
                            {field.secret && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowSecrets((prev) => ({
                                    ...prev,
                                    [provider.key]: !prev[provider.key],
                                  }))
                                }
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted hover:text-foreground transition-colors"
                              >
                                {showSecrets[provider.key] ? "Hide" : "Show"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <button
                      onClick={() => handleSave(provider)}
                      disabled={isSaving || !hasFormValues}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Credentials"}
                    </button>
                    <button
                      onClick={() => handleTest(provider)}
                      disabled={isTesting || !provider.isConfigured}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
                    >
                      {isTesting ? "Testing..." : "Test Connection"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ provider }: { provider: ProviderStatus }) {
  if (provider.hasDbConfig) {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        Custom
      </span>
    );
  }
  if (provider.hasEnvVars) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
        Env Vars
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-600">
      Not Set
    </span>
  );
}

function getProviderIcon(key: string): string {
  const icons: Record<string, string> = {
    gmail: "\uD83D\uDCE7",
    "google-calendar": "\uD83D\uDCC6",
    outlook: "\uD83D\uDCE8",
    slack: "\uD83D\uDCAC",
    twilio: "\uD83D\uDCDE",
  };
  return icons[key] || "\uD83D\uDD17";
}
