"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useApi } from "@/lib/hooks/use-api";
import { CardSkeleton } from "@/components/shared/skeleton";

const typeConfig: Record<string, { color: string; label: string }> = {
  DISCOVERY: { color: "bg-blue-100 text-blue-700", label: "Discovery" },
  NEGOTIATION: { color: "bg-orange-100 text-orange-700", label: "Negotiation" },
  DEMO: { color: "bg-purple-100 text-purple-700", label: "Demo" },
  PROPOSAL: { color: "bg-teal-100 text-teal-700", label: "Proposal" },
  INTERNAL: { color: "bg-gray-100 text-gray-700", label: "Internal" },
  // lowercase fallback
  discovery: { color: "bg-blue-100 text-blue-700", label: "Discovery" },
  negotiation: { color: "bg-orange-100 text-orange-700", label: "Negotiation" },
  demo: { color: "bg-purple-100 text-purple-700", label: "Demo" },
  proposal: { color: "bg-teal-100 text-teal-700", label: "Proposal" },
  internal: { color: "bg-gray-100 text-gray-700", label: "Internal" },
};

export default function MeetingsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: meetings, loading } = useApi<any[]>("/api/meetings?limit=50");

  const now = new Date();

  const upcoming = useMemo(
    () =>
      (meetings ?? [])
        .filter((m: any) => new Date(m.startTime) >= now)
        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [meetings]
  );

  const past = useMemo(
    () =>
      (meetings ?? [])
        .filter((m: any) => new Date(m.startTime) < now)
        .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [meetings]
  );

  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-4">
      <PageHeader title="Meetings" subtitle={`${upcoming.length} upcoming meetings`} />

      <div className="flex gap-2">
        <button
          onClick={() => setTab("upcoming")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "upcoming" ? "bg-primary text-white" : "bg-surface border border-border text-muted"
          }`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab("past")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "past" ? "bg-primary text-white" : "bg-surface border border-border text-muted"
          }`}
        >
          Past ({past.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((m: any) => {
            const cfg = typeConfig[m.type] || typeConfig.internal;
            const d = new Date(m.startTime);
            const attendees = m.attendees || (m.contact ? [m.contact.name] : []);
            return (
              <div key={m.id} className="rounded-xl border border-border bg-surface p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{d.getDate()}</p>
                      <p className="text-xs text-muted uppercase">
                        {d.toLocaleDateString([], { month: "short" })}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{m.title}</h3>
                      <p className="text-xs text-muted mt-0.5">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {m.duration || 30}min · {m.location || "Online"}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                        {attendees.length > 0 && (
                          <span className="text-xs text-muted">
                            {Array.isArray(attendees) ? attendees.join(", ") : attendees}
                          </span>
                        )}
                      </div>
                      {m.notes && (
                        <p className="text-xs text-muted mt-2 bg-background rounded px-2 py-1">{m.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {new Date(m.startTime) >= now && m.location && (
                      <a
                        href={m.location.startsWith("http") ? m.location : `#`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                      >
                        Join
                      </a>
                    )}
                    <button
                      onClick={() => {
                        const detail = document.getElementById(`meeting-detail-${m.id}`);
                        if (detail) detail.classList.toggle("hidden");
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
                <div id={`meeting-detail-${m.id}`} className="hidden border-t border-border mt-3 pt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted">Location:</span> <span className="text-foreground">{m.location || "Not specified"}</span></div>
                  <div><span className="text-muted">Duration:</span> <span className="text-foreground">{m.duration || 30} minutes</span></div>
                  <div><span className="text-muted">Attendees:</span> <span className="text-foreground">{attendees.length > 0 ? (Array.isArray(attendees) ? attendees.join(", ") : attendees) : "None"}</span></div>
                  <div><span className="text-muted">Created:</span> <span className="text-foreground">{new Date(m.createdAt).toLocaleDateString()}</span></div>
                </div>
              </div>
            );
          })}
          {displayed.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-sm text-muted">
              No {tab} meetings
            </div>
          )}
        </div>
      )}
    </div>
  );
}
