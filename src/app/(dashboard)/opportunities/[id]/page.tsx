"use client";

import Link from "next/link";
import { RecommendationPanel } from "@/components/dashboard/RecommendationPanel";
import { AlertsPanel } from "@/components/shared/alerts-panel";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HealthBadge } from "@/components/shared/health-badge";
import { formatCurrency, getInitials } from "@/lib/utils";
import { useApi, apiPut, apiDelete, apiPost } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { EditOpportunityModal } from "@/components/opportunities/edit-opportunity-modal";
import { LogActivityModal } from "@/components/shared/log-activity-modal";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { CanonicalTimeline } from "@/components/shared/canonical-timeline";
import { SuggestedPlaybooks } from "@/components/shared/suggested-playbooks";
import { ExplainableScore } from "@/components/scoring/explainable-score";
import type { ScoreResult } from "@/lib/scoring/engine";

interface Opportunity {
  id: string;
  title: string;
  description?: string;
  value: number;
  stage: string;
  stageId?: string;
  stageRelation?: { id: string; name: string; color?: string };
  accountId: string;
  account?: { id: string; name: string; company?: { name: string; industry?: string } };
  ownerId: string;
  ownerName?: string;
  owner?: { id: string; name: string; email: string };
  primaryContactId?: string;
  primaryContact?: { id: string; name: string; email: string; title?: string };
  probability: number;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
  tasks?: { id: string; title: string; status: string; priority: string; owner?: { id: string; name: string } }[];
  insights?: { id: string; title: string; impact: string; confidence: number }[];
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

const STAGE_COLORS: Record<string, string> = {
  DISCOVERY: "bg-blue-50 text-blue-700",
  QUALIFICATION: "bg-indigo-50 text-indigo-700",
  PROPOSAL: "bg-violet-50 text-violet-700",
  NEGOTIATION: "bg-amber-50 text-amber-700",
  CLOSED_WON: "bg-emerald-50 text-emerald-700",
  CLOSED_LOST: "bg-red-50 text-red-700",
};

const OPP_STAGES = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];
const PIPELINE_STAGES = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"];

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const oppId = params.id as string;
  const { toastSuccess, toastError } = useToast();
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [activityType, setActivityType] = useState<string | null>(null);

  const { data: deal, loading: dealLoading, refetch } = useApi<Opportunity>(`/api/opportunities/${oppId}`);
  const { data: activities, loading: activitiesLoading, refetch: refetchActivities } = useApi<Activity[]>(`/api/activities?opportunityId=${oppId}`);

  if (dealLoading) {
    return <DetailSkeleton />;
  }

  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Opportunity not found</p>
        <Link href="/opportunities" className="mt-2 text-primary text-sm hover:underline">Back to Opportunities</Link>
      </div>
    );
  }

  const stageLabel = deal.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const ownerName = deal.owner?.name || deal.ownerName || "Unassigned";
  const accountName = deal.account?.name || "Unknown";
  const timeline = activities || [];

  // Activity summary counts
  const activityCounts = timeline.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <Link href="/opportunities" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 18-6-6 6-6" /></svg>
        Back to Opportunities
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-light text-lg font-bold text-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
              <path d="M12 18V6" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[deal.stage] || "bg-gray-100 text-gray-700"}`}>
                {stageLabel}
              </span>
              <HealthBadge score={deal.probability} size="md" />
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(deal.value, "BRL")}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-semibold text-primary">
                {getInitials(ownerName)}
              </div>
              <span className="text-sm text-muted">{ownerName}</span>
              <span className="text-muted">·</span>
              <span className="text-sm text-muted">{accountName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Edit
          </button>
          <select
            value={deal.stage}
            disabled={updating}
            onChange={async (e) => {
              const newStage = e.target.value;
              setUpdating(true);
              const { error } = await apiPost(`/api/opportunities/${oppId}/stage-transition`, { targetStage: newStage });
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess(`Stage changed to ${newStage.replace(/_/g, " ")}`);
              refetch();
              refetchActivities();
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors focus:border-primary"
          >
            {OPP_STAGES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          {!["CLOSED_WON", "CLOSED_LOST"].includes(deal.stage) && (
            <button
              disabled={updating}
              onClick={async () => {
                const idx = OPP_STAGES.indexOf(deal.stage);
                const nextStage = OPP_STAGES[idx + 1];
                if (!nextStage) return;
                setUpdating(true);
                const { error } = await apiPost(`/api/opportunities/${oppId}/stage-transition`, { targetStage: nextStage });
                setUpdating(false);
                if (error) { toastError(error); return; }
                toastSuccess(`Stage advanced to ${nextStage.replace(/_/g, " ")}`);
                refetch();
                refetchActivities();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {updating ? "Updating..." : `Advance Stage`}
            </button>
          )}
          {!["CLOSED_WON", "CLOSED_LOST"].includes(deal.stage) && (
            <button
              disabled={updating}
              onClick={async () => {
                setUpdating(true);
                const { error } = await apiPost(`/api/opportunities/${oppId}/stage-transition`, { targetStage: "CLOSED_LOST" });
                setUpdating(false);
                if (error) { toastError(error); return; }
                toastSuccess("Deal marked as lost");
                refetch();
                refetchActivities();
              }}
              className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
            >
              Register Loss
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm("Are you sure you want to delete this opportunity? This action cannot be undone.")) return;
              setUpdating(true);
              const { error } = await apiDelete(`/api/opportunities/${oppId}`);
              setUpdating(false);
              if (error) { toastError(error); return; }
              toastSuccess("Opportunity deleted");
              router.push("/opportunities");
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
            disabled={updating}
            title="Delete opportunity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dynamic Recommendation Engine */}
      {!["CLOSED_WON", "CLOSED_LOST"].includes(deal.stage) && (
        <RecommendationPanel entityType="opportunity" entityId={oppId} title="Recommended Actions" />
      )}

      {/* Alert Banners */}
      {!["CLOSED_WON", "CLOSED_LOST"].includes(deal.stage) && (
        <div className="mb-4 space-y-2">
          {/* At Risk Deal */}
          {deal.probability < 30 && (
            <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-light px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-sm font-medium text-danger">At Risk</p>
                <p className="text-xs text-muted">Win probability is only {deal.probability}%. Review deal strategy and stakeholder engagement.</p>
              </div>
            </div>
          )}
          {/* Stuck Deal - no update in 14+ days */}
          {new Date(deal.updatedAt) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-light px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning shrink-0">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <p className="text-sm font-medium text-warning">Stuck Deal</p>
                <p className="text-xs text-muted">No updates for {Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24))} days. Consider scheduling a check-in.</p>
              </div>
            </div>
          )}
          {/* High Value Low Confidence */}
          {deal.value > 100000 && deal.probability < 50 && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-light px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning shrink-0">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <div>
                <p className="text-sm font-medium text-warning">High Value, Low Confidence</p>
                <p className="text-xs text-muted">This is a high-value deal but confidence is below 50%. Prioritize advancing it.</p>
              </div>
            </div>
          )}
          {/* Upcoming Deadline */}
          {deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && new Date(deal.expectedCloseDate) > new Date() && ["DISCOVERY", "QUALIFICATION"].includes(deal.stage) && (
            <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-light px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div>
                <p className="text-sm font-medium text-danger">Closing Deadline Approaching</p>
                <p className="text-xs text-muted">Expected close date is {new Date(deal.expectedCloseDate).toLocaleDateString()} but deal is still in {deal.stage.replace(/_/g, " ")} stage.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">

          {/* Explainable Probability Score */}
          {deal.scoring && (
            <ExplainableScore scoreData={deal.scoring} type="Probability" />
          )}

          {/* Stage Progression */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Stage Progression</h3>
            <div className="flex items-center justify-between">
              {PIPELINE_STAGES.map((stage, i) => {
                const currentIdx = PIPELINE_STAGES.indexOf(deal.stage);
                const isWon = deal.stage === "CLOSED_WON";
                const isLost = deal.stage === "CLOSED_LOST";
                const isPassed = isWon || i < currentIdx;
                const isCurrent = !isWon && !isLost && stage === deal.stage;
                return (
                  <div key={stage} className="flex items-center flex-1">
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
                      <span className={`mt-1.5 text-[10px] font-medium ${isCurrent ? "text-primary" : isPassed ? "text-success" : "text-muted"}`}>
                        {stage.charAt(0) + stage.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 rounded ${isPassed ? "bg-success" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {deal.stage === "CLOSED_WON" && (
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 text-center">
                Deal closed - Won
              </div>
            )}
            {deal.stage === "CLOSED_LOST" && (
              <div className="mt-3 rounded-lg bg-danger-light px-3 py-2 text-xs font-medium text-danger text-center">
                Deal closed - Lost
              </div>
            )}
          </div>

          {/* Deal Summary Card */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Deal Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted">Account</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{accountName}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Stage</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{stageLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Owner</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{ownerName}</p>
              </div>
              {deal.expectedCloseDate && (
                <div>
                  <p className="text-xs text-muted">Close Date</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{new Date(deal.expectedCloseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted">Probability</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{deal.probability}%</p>
              </div>
              <div>
                <p className="text-xs text-muted">Created</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{new Date(deal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              {deal.primaryContact && (
                <div>
                  <p className="text-xs text-muted">Primary Contact</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{deal.primaryContact.name}</p>
                  <p className="text-xs text-muted">{deal.primaryContact.title || deal.primaryContact.email}</p>
                </div>
              )}
            </div>
            {deal.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted mb-1">Description</p>
                <p className="text-sm text-foreground">{deal.description}</p>
              </div>
            )}
          </div>

          {/* Tasks */}
          {deal.tasks && deal.tasks.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-base font-semibold text-foreground">Tasks ({deal.tasks.length})</h3>
              <div className="space-y-2">
                {deal.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${task.status === "COMPLETED" ? "bg-success" : task.priority === "HIGH" ? "bg-danger" : "bg-warning"}`} />
                      <div>
                        <p className={`text-sm font-medium ${task.status === "COMPLETED" ? "text-muted line-through" : "text-foreground"}`}>{task.title}</p>
                        <p className="text-xs text-muted">{task.owner?.name || "Unassigned"} · {task.priority}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${task.status === "COMPLETED" ? "text-success" : "text-muted"}`}>{task.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {deal.insights && deal.insights.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary-light/30 p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                AI Insights
              </h3>
              <div className="space-y-3">
                {deal.insights.map((insight) => (
                  <div key={insight.id} className="rounded-lg bg-white/60 px-3 py-2.5 border border-primary/10">
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted">Impact: {insight.impact}</span>
                      <span className="text-xs text-muted">· Confidence: {insight.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Timeline</h3>
            <CanonicalTimeline entityType="opportunity" entityId={oppId} showFilters />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Deal Information */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Deal Information</h3>
            <dl className="space-y-3">
              {[
                { label: "Deal Value", value: formatCurrency(deal.value, "BRL") },
                { label: "Stage", value: stageLabel },
                { label: "Probability", value: `${deal.probability}%` },
                ...(deal.expectedCloseDate ? [{ label: "Close Date", value: new Date(deal.expectedCloseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }] : []),
                { label: "Owner", value: ownerName },
                { label: "Account", value: accountName },
                { label: "Created", value: new Date(deal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Activity Summary */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Activity Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Calls", count: activityCounts["CALL"] || 0 },
                { label: "Emails", count: activityCounts["EMAIL"] || 0 },
                { label: "Meetings", count: activityCounts["MEETING"] || 0 },
                { label: "Notes", count: activityCounts["NOTE"] || 0 },
              ].map((a) => (
                <div key={a.label} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{a.count}</p>
                  <p className="text-xs text-muted">{a.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Send Email", type: "EMAIL" },
                { label: "Log Call", type: "CALL" },
                { label: "Meeting", type: "MEETING" },
                { label: "Add Note", type: "NOTE" },
                { label: "WhatsApp", type: "WHATSAPP" },
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

          {/* Stakeholders */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Key Stakeholders</h3>
            <div className="space-y-2.5">
              {deal.primaryContact ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary">
                    {getInitials(deal.primaryContact.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{deal.primaryContact.name}</p>
                    <p className="text-[11px] text-muted">{deal.primaryContact.title || "Contact"} · Champion</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No primary contact linked</p>
              )}
              {deal.account?.company && (
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-[10px] font-bold text-muted">🏢</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{deal.account.company.name}</p>
                    <p className="text-[11px] text-muted">{deal.account.company.industry || "Company"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Competitive Intelligence */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Competitive Landscape</h3>
            <div className="space-y-2">
              {["No direct competitors identified"].map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2">
                  <span className="text-xs text-muted">{item}</span>
                </div>
              ))}
              <p className="text-[10px] text-muted mt-2">Competitor tracking available in future release.</p>
            </div>
          </div>

          {/* Objections */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Objections & Risks</h3>
            {deal.probability < 50 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-light px-3 py-2">
                  <span className="text-xs font-medium text-danger">Low Probability ({deal.probability}%)</span>
                </div>
                {deal.stage === "NEGOTIATION" && (
                  <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-light px-3 py-2">
                    <span className="text-xs font-medium text-warning">Potential pricing objection — deal in negotiation</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">No major objections flagged. Deal health is good.</p>
            )}
          </div>

          <SuggestedPlaybooks stage={deal.stage} entityType="opportunity" />

          <AlertsPanel filterEntity="opportunity" compact title="Deal Alerts" maxItems={3} />
        </div>
      </div>

      <EditOpportunityModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onUpdated={() => { refetch(); refetchActivities(); }}
        opportunity={deal}
      />

      <LogActivityModal
        open={!!activityType}
        onClose={() => setActivityType(null)}
        onCreated={() => refetchActivities()}
        defaultType={activityType || "NOTE"}
        opportunityId={oppId}
      />
    </div>
  );
}
