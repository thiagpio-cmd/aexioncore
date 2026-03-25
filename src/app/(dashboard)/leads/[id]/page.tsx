"use client";

import Link from "next/link";
import { RecommendationPanel } from "@/components/dashboard/RecommendationPanel";
import { AlertsPanel } from "@/components/shared/alerts-panel";
import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/shared/health-badge";
import { getInitials } from "@/lib/utils";
import { useApi, apiPut, apiDelete } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { EditLeadModal } from "@/components/leads/edit-lead-modal";
import { ConvertLeadModal } from "@/components/leads/convert-lead-modal";
import { LogActivityModal } from "@/components/shared/log-activity-modal";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { CanonicalTimeline } from "@/components/shared/canonical-timeline";
import { SuggestedPlaybooks } from "@/components/shared/suggested-playbooks";
import { ExplainableScore } from "@/components/scoring/explainable-score";
import { AICoachPanel } from "@/components/ai/ai-coach-panel";
import type { ScoreResult } from "@/lib/scoring/engine";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  source: string;
  status: string;
  temperature: string;
  fitScore: number;
  ownerId: string;
  owner?: { id: string; name: string; email: string };
  company?: { id: string; name: string; website?: string };
  contact?: { id: string; name: string; email: string; phone?: string };
  lastContact?: string;
  createdAt: string;
  updatedAt: string;
  scoring?: ScoreResult;
}

interface Activity {
  id: string;
  type: string;
  channel?: string;
  subject?: string;
  body?: string;
  creatorId: string;
  creator?: { id: string; name: string };
  createdAt: string;
}

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED"];
const PIPELINE_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED"];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = params.id as string;
  const { toastSuccess, toastError } = useToast();
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (searchParams.get("edit") === "true") {
      setShowEdit(true);
    }
  }, [searchParams]);
  const [showConvert, setShowConvert] = useState(false);
  const [activityType, setActivityType] = useState<string | null>(null);

  const { data: lead, loading: leadLoading, refetch } = useApi<Lead>(`/api/leads/${leadId}`);
  const { data: activities, loading: activitiesLoading, refetch: refetchActivities } = useApi<Activity[]>(`/api/activities?leadId=${leadId}`);

  if (leadLoading) {
    return <DetailSkeleton />;
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Lead not found</p>
        <Link href="/leads" className="mt-2 text-primary text-sm hover:underline">Back to Leads</Link>
      </div>
    );
  }

  const timeline = activities || [];

  return (
    <div>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6" /></svg>
        Back to Leads
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-lg font-bold text-primary">
            {getInitials(lead.name)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
              <StatusBadge status={lead.status} />
              <StatusBadge status={lead.temperature} />
            </div>
            <p className="mt-0.5 text-sm text-muted">{lead.title || "No title"} at {lead.company?.name || "Unknown"}</p>
            <p className="text-sm text-muted">{lead.email}{lead.phone ? ` · ${lead.phone}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Edit
          </button>
          {lead.status !== "CONVERTED" && lead.status !== "DISQUALIFIED" && (
            <button
              onClick={() => setShowConvert(true)}
              className="rounded-lg bg-success px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              Convert
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm("Are you sure you want to delete this lead? This action cannot be undone.")) return;
              setUpdating(true);
              const { error } = await apiDelete(`/api/leads/${leadId}`);
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess("Lead deleted");
              router.push("/leads");
            }}
            className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
            disabled={updating}
          >
            Delete
          </button>
          <select
            value={lead.status}
            disabled={updating}
            onChange={async (e) => {
              const newStatus = e.target.value;
              setUpdating(true);
              const { error } = await apiPut(`/api/leads/${leadId}`, { status: newStatus });
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess(`Status changed to ${newStatus}`);
              refetch();
              refetchActivities();
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors focus:border-primary"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          {lead.status !== "DISQUALIFIED" && lead.status !== "CONVERTED" && (
            <button
              disabled={updating}
              onClick={async () => {
                const nextStatus = LEAD_STATUSES[LEAD_STATUSES.indexOf(lead.status) + 1];
                if (!nextStatus) return;
                setUpdating(true);
                const { error } = await apiPut(`/api/leads/${leadId}`, { status: nextStatus });
                setUpdating(false);
                if (error) { toastError(error); return; }
                toastSuccess(`Lead advanced to ${nextStatus}`);
                refetch();
                refetchActivities();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {updating ? "Updating..." : `Advance to ${LEAD_STATUSES[LEAD_STATUSES.indexOf(lead.status) + 1] || ""}`.replace(/_/g, " ")}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Recommendation Engine */}
      {lead.status !== "CONVERTED" && lead.status !== "DISQUALIFIED" && (
        <RecommendationPanel entityType="lead" entityId={leadId} title="Recommended Actions" />
      )}

      {/* Alert Banners */}
      {lead.status !== "CONVERTED" && lead.status !== "DISQUALIFIED" && (
        <div className="mb-4 space-y-2">
          {/* Stale Lead Warning */}
          {lead.lastContact && new Date(lead.lastContact) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-light px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-sm font-medium text-warning">Stale Lead</p>
                <p className="text-xs text-muted">Last contact was {Math.floor((Date.now() - new Date(lead.lastContact).getTime()) / (1000 * 60 * 60 * 24))} days ago. Consider reaching out.</p>
              </div>
            </div>
          )}
          {/* No Contact Yet */}
          {!lead.lastContact && lead.status === "NEW" && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary-light px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="text-sm font-medium text-primary">No Contact Yet</p>
                <p className="text-xs text-muted">This lead hasn&apos;t been contacted. Use Quick Actions to reach out.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          
          {/* Explainable Fit Score */}
          {lead.scoring && (
            <ExplainableScore scoreData={lead.scoring} type="Fit" />
          )}

          {/* Status Pipeline */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Pipeline Progress</h3>
            <div className="flex items-center justify-between">
              {PIPELINE_STATUSES.map((status, i) => {
                const currentIdx = PIPELINE_STATUSES.indexOf(lead.status);
                const isPassed = i < currentIdx;
                const isCurrent = status === lead.status;
                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          isPassed
                            ? "bg-success text-white"
                            : isCurrent
                            ? "bg-primary text-white ring-4 ring-primary/20"
                            : "bg-background text-muted border border-border"
                        }`}
                      >
                        {isPassed ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`mt-1.5 text-xs font-medium ${isCurrent ? "text-primary" : isPassed ? "text-success" : "text-muted"}`}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {i < PIPELINE_STATUSES.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 rounded ${isPassed ? "bg-success" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {lead.status === "DISQUALIFIED" && (
              <div className="mt-3 rounded-lg bg-danger-light px-3 py-2 text-xs font-medium text-danger text-center">
                This lead has been disqualified
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Timeline</h3>
            <CanonicalTimeline entityType="lead" entityId={leadId} showFilters />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* AI Coach Panel */}
          {lead.status !== "CONVERTED" && lead.status !== "DISQUALIFIED" && (
            <AICoachPanel entityType="lead" entityId={leadId} />
          )}

          {/* AI Channel Suggestion */}
          {lead.status !== "CONVERTED" && lead.status !== "DISQUALIFIED" && (() => {
            const channelScore: Record<string, number> = { email: 2, whatsapp: 3, phone: 1, linkedin: 1 };
            const activityChannels = (activities || []).map(a => a.channel).filter(Boolean);
            activityChannels.forEach(ch => { if (ch && channelScore[ch]) channelScore[ch] += 2; });
            if (lead.temperature === "HOT") { channelScore.phone += 3; channelScore.whatsapp += 2; }
            if (lead.temperature === "WARM") channelScore.email += 2;
            if (lead.source === "linkedin") channelScore.linkedin += 3;
            if (lead.source === "email" || lead.source === "web") channelScore.email += 2;
            const best = Object.entries(channelScore).sort((a, b) => b[1] - a[1])[0];
            const channelLabels: Record<string, string> = { email: "📧 Email", whatsapp: "💬 WhatsApp", phone: "📞 Phone Call", linkedin: "💼 LinkedIn" };
            const timeHint = lead.temperature === "HOT" ? "Today — high urgency" : lead.temperature === "WARM" ? "Within 24h" : "Within 48h";
            return (
              <div className="rounded-xl border border-primary/20 bg-primary-light p-4">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">AI Suggested Channel</p>
                <p className="text-sm font-semibold text-foreground">{channelLabels[best[0]] || best[0]}</p>
                <p className="text-xs text-muted mt-1">Best time: {timeHint}</p>
                <p className="text-[11px] text-muted mt-2">Based on lead source ({lead.source}), temperature ({lead.temperature}), and {activityChannels.length} past interactions.</p>
              </div>
            );
          })()}

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Send Email", type: "EMAIL" },
                { label: "Log Call", type: "CALL" },
                { label: "WhatsApp", type: "WHATSAPP" },
                { label: "Meeting", type: "MEETING" },
                { label: "Add Note", type: "NOTE" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => setActivityType(action.type)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-background"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Lead Information</h3>
            <dl className="space-y-3">
              {[
                { label: "Source", value: lead.source },
                { label: "Temperature", value: lead.temperature },
                { label: "Status", value: lead.status },
                { label: "Owner", value: lead.owner?.name || "Unassigned" },
                { label: "Company", value: lead.company?.name || "Unknown" },
                { label: "Created", value: new Date(lead.createdAt).toLocaleDateString() },
                ...(lead.lastContact ? [{ label: "Last Contact", value: new Date(lead.lastContact).toLocaleDateString() }] : []),
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <SuggestedPlaybooks stage={lead.status} entityType="lead" />

          <AlertsPanel filterEntity="lead" compact title="Lead Alerts" maxItems={3} />

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Quick Message</h3>
            <textarea placeholder="Type a message..." className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none placeholder:text-muted/50 focus:border-primary resize-none" rows={3} />
            <div className="mt-2 flex items-center justify-between">
              <select className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted">
                <option>Email</option><option>WhatsApp</option>
              </select>
              <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors">Send</button>
            </div>
          </div>
        </div>
      </div>

      <EditLeadModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onUpdated={() => { refetch(); refetchActivities(); }}
        lead={lead}
      />

      <ConvertLeadModal
        open={showConvert}
        onClose={() => setShowConvert(false)}
        onConverted={() => { refetch(); refetchActivities(); }}
        lead={lead}
      />

      <LogActivityModal
        open={!!activityType}
        onClose={() => setActivityType(null)}
        onCreated={() => refetchActivities()}
        defaultType={activityType || "NOTE"}
        leadId={leadId}
      />
    </div>
  );
}
