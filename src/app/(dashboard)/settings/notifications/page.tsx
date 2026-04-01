"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/shared/toast";

interface ChannelPrefs {
  email: boolean;
  push: boolean;
}

type PrefsMap = Record<string, ChannelPrefs>;

const NOTIFICATION_CATEGORIES = [
  {
    title: "Deals & Pipeline",
    events: [
      { key: "deal_at_risk", label: "Deal at Risk", description: "When a deal's health score drops below threshold" },
      { key: "deal_stage_change", label: "Stage Change", description: "When a deal moves to a new pipeline stage" },
      { key: "deal_won", label: "Deal Won", description: "When a deal is marked as won" },
      { key: "deal_lost", label: "Deal Lost", description: "When a deal is marked as lost" },
    ],
  },
  {
    title: "Tasks & Activities",
    events: [
      { key: "task_due", label: "Task Due", description: "Reminder when a task is approaching its deadline" },
      { key: "task_overdue", label: "Task Overdue", description: "When a task passes its due date" },
      { key: "meeting_reminder", label: "Meeting Reminder", description: "Before upcoming meetings" },
    ],
  },
  {
    title: "Intelligence",
    events: [
      { key: "icp_match", label: "ICP Match Found", description: "When a new contact matches an ICP profile" },
      { key: "debrief_ready", label: "Debrief Analysis Ready", description: "When AI finishes analyzing a debrief" },
      { key: "signal_detected", label: "Behavioral Signal", description: "When the engine detects a relevant behavioral pattern" },
      { key: "score_change", label: "Score Change", description: "When execution or deal scores change significantly" },
    ],
  },
  {
    title: "Team & System",
    events: [
      { key: "team_mention", label: "Mentions", description: "When someone mentions you in a note or comment" },
      { key: "lead_assigned", label: "Lead Assigned", description: "When a new lead is assigned to you" },
      { key: "system_alert", label: "System Alerts", description: "Important system notifications and updates" },
    ],
  },
];

const DEFAULT_PREFS: ChannelPrefs = { email: true, push: true };

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        enabled ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export default function SettingsNotificationsPage() {
  const { toastSuccess, toastError } = useToast();
  const [prefs, setPrefs] = useState<PrefsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/users/notifications");
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        const stored = json.data?.notificationPrefs;
        if (stored) {
          setPrefs(typeof stored === "string" ? JSON.parse(stored) : stored);
        }
      } catch {
        // Use defaults — user hasn't set any prefs yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getPrefs = useCallback(
    (key: string): ChannelPrefs => prefs[key] ?? DEFAULT_PREFS,
    [prefs]
  );

  function updatePref(key: string, channel: "email" | "push", value: boolean) {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...getPrefs(key), [channel]: value },
    }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/users/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPrefs: prefs }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setDirty(false);
      toastSuccess("Preferencias salvas com sucesso");
    } catch {
      toastError("Erro ao salvar preferencias");
    } finally {
      setSaving(false);
    }
  }

  function enableAll() {
    const all: PrefsMap = {};
    for (const cat of NOTIFICATION_CATEGORIES) {
      for (const evt of cat.events) {
        all[evt.key] = { email: true, push: true };
      }
    }
    setPrefs(all);
    setDirty(true);
  }

  function disableAll() {
    const all: PrefsMap = {};
    for (const cat of NOTIFICATION_CATEGORIES) {
      for (const evt of cat.events) {
        all[evt.key] = { email: false, push: false };
      }
    }
    setPrefs(all);
    setDirty(true);
  }

  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Voltar para Configuracoes
      </Link>

      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Notificacoes"
          description="Configure quais eventos geram notificacoes e por qual canal"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={enableAll}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted border border-border transition-colors hover:text-foreground hover:bg-surface"
          >
            Ativar Tudo
          </button>
          <button
            onClick={disableAll}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted border border-border transition-colors hover:text-foreground hover:bg-surface"
          >
            Desativar Tudo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-5 space-y-4">
              <div className="h-4 w-32 rounded bg-border" />
              <div className="space-y-3">
                <div className="h-10 rounded bg-border/50" />
                <div className="h-10 rounded bg-border/50" />
                <div className="h-10 rounded bg-border/50" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <div
              key={category.title}
              className="rounded-xl border border-border bg-surface overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-border bg-background/50">
                <h3 className="text-sm font-semibold text-foreground">
                  {category.title}
                </h3>
              </div>

              {/* Header */}
              <div className="px-5 py-2 flex items-center border-b border-border/50">
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Evento
                </span>
                <span className="w-16 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Email
                </span>
                <span className="w-16 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Push
                </span>
              </div>

              {/* Rows */}
              {category.events.map((evt, i) => {
                const p = getPrefs(evt.key);
                return (
                  <div
                    key={evt.key}
                    className={`px-5 py-3 flex items-center gap-4 transition-colors hover:bg-background/30 ${
                      i < category.events.length - 1 ? "border-b border-border/30" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {evt.label}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {evt.description}
                      </p>
                    </div>
                    <div className="w-16 flex justify-center">
                      <Toggle
                        enabled={p.email}
                        onChange={(v) => updatePref(evt.key, "email", v)}
                        label={`${evt.label} email`}
                      />
                    </div>
                    <div className="w-16 flex justify-center">
                      <Toggle
                        enabled={p.push}
                        onChange={(v) => updatePref(evt.key, "push", v)}
                        label={`${evt.label} push`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Save bar */}
          {dirty && (
            <div className="sticky bottom-4 flex items-center justify-between rounded-xl border border-primary/20 bg-surface px-5 py-3 shadow-lg">
              <p className="text-sm text-muted">
                Voce tem alteracoes nao salvas
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Preferencias"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
