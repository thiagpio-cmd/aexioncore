"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeleton";

interface TranscriptDetail {
  id: string;
  source: string;
  title: string | null;
  rawTranscript: string;
  summary: string | null;
  actionItems: string | null;
  sentiment: string | null;
  keyTopics: string | null;
  nextSteps: string | null;
  objections: string | null;
  buyingSignals: string | null;
  duration: number | null;
  participants: string | null;
  processedAt: string | null;
  processingError: string | null;
  createdAt: string;
  meeting: { id: string; title: string; startTime: string } | null;
  lead: { id: string; name: string; email: string } | null;
  opportunity: { id: string; title: string; value: number; stage: string } | null;
  account: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string } | null;
}

const SENTIMENT_STYLES: Record<string, { label: string; class: string }> = {
  positive: { label: "Positive", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  neutral: { label: "Neutral", class: "bg-gray-50 text-gray-600 border-gray-200" },
  negative: { label: "Negative", class: "bg-red-50 text-red-700 border-red-200" },
  mixed: { label: "Mixed", class: "bg-amber-50 text-amber-700 border-amber-200" },
};

function parseJson<T>(str: string | null): T | null {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

export default function TranscriptDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [showTranscript, setShowTranscript] = useState(true);

  const { data: transcript, loading } = useApi<TranscriptDetail>(`/api/transcripts/${id}`);

  if (loading) return <DetailSkeleton />;
  if (!transcript) return (
    <div className="text-center py-20">
      <p className="text-muted">Transcript not found</p>
      <Link href="/transcripts" className="mt-2 text-primary text-sm hover:underline">Back to Transcripts</Link>
    </div>
  );

  const actionItems = parseJson<{ text: string; assignee?: string; priority?: string }[]>(transcript.actionItems);
  const keyTopics = parseJson<string[]>(transcript.keyTopics);
  const nextSteps = parseJson<string[]>(transcript.nextSteps);
  const objections = parseJson<string[]>(transcript.objections);
  const buyingSignals = parseJson<string[]>(transcript.buyingSignals);
  const participants = parseJson<{ name: string; email?: string }[]>(transcript.participants);
  const sentimentStyle = transcript.sentiment ? SENTIMENT_STYLES[transcript.sentiment] : null;

  const mins = transcript.duration ? Math.floor(transcript.duration / 60) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={transcript.title || "Meeting Transcript"}
        description={`${transcript.source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} | ${new Date(transcript.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${mins ? ` | ${mins} min` : ""}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          {transcript.summary && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">AI Summary</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{transcript.summary}</p>
            </div>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap gap-2">
            {sentimentStyle && (
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${sentimentStyle.class}`}>
                Sentiment: {sentimentStyle.label}
              </span>
            )}
            {keyTopics?.map((topic, i) => (
              <span key={i} className="rounded-full bg-surface border border-border px-3 py-1 text-xs text-foreground">
                {topic}
              </span>
            ))}
          </div>

          {/* Action Items */}
          {actionItems && actionItems.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Action Items</h3>
              <ul className="space-y-2">
                {actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 accent-primary" />
                    <div>
                      <span className="text-sm text-foreground">{item.text}</span>
                      {item.assignee && (
                        <span className="ml-2 text-xs text-muted">({item.assignee})</span>
                      )}
                      {item.priority === "high" && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">High</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Objections */}
          {objections && objections.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Objections Raised</h3>
              <ul className="space-y-1">
                {objections.map((obj, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">!</span> {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Buying Signals */}
          {buyingSignals && buyingSignals.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <h3 className="text-sm font-semibold text-emerald-800 mb-2">Buying Signals</h3>
              <ul className="space-y-1">
                {buyingSignals.map((signal, i) => (
                  <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">+</span> {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {nextSteps && nextSteps.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Next Steps</h3>
              <ul className="space-y-1">
                {nextSteps.map((step, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="text-primary">→</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Transcript */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Full Transcript</h3>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-xs text-primary hover:underline"
              >
                {showTranscript ? "Collapse" : "Expand"}
              </button>
            </div>
            {showTranscript && (
              <pre className="text-sm text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed max-h-[500px] overflow-y-auto">
                {transcript.rawTranscript}
              </pre>
            )}
          </div>
        </div>

        {/* Right column — Context */}
        <div className="space-y-4">
          {/* Participants */}
          {participants && participants.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Participants</h3>
              <ul className="space-y-2">
                {participants.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      {p.email && <div className="text-xs text-muted">{p.email}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Linked Entities */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Linked To</h3>

            {transcript.opportunity && (
              <Link
                href={`/opportunities/${transcript.opportunity.id}`}
                className="block rounded-lg border border-border p-3 hover:border-primary/30 transition-colors"
              >
                <div className="text-xs text-muted uppercase">Opportunity</div>
                <div className="text-sm font-medium text-foreground">{transcript.opportunity.title}</div>
                <div className="text-xs text-muted">
                  ${(transcript.opportunity.value / 100).toLocaleString()} | {transcript.opportunity.stage.replace(/_/g, " ")}
                </div>
              </Link>
            )}

            {transcript.lead && (
              <Link
                href={`/leads/${transcript.lead.id}`}
                className="block rounded-lg border border-border p-3 hover:border-primary/30 transition-colors"
              >
                <div className="text-xs text-muted uppercase">Lead</div>
                <div className="text-sm font-medium text-foreground">{transcript.lead.name}</div>
                <div className="text-xs text-muted">{transcript.lead.email}</div>
              </Link>
            )}

            {transcript.account && (
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted uppercase">Account</div>
                <div className="text-sm font-medium text-foreground">{transcript.account.name}</div>
              </div>
            )}

            {transcript.contact && (
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted uppercase">Contact</div>
                <div className="text-sm font-medium text-foreground">{transcript.contact.name}</div>
                <div className="text-xs text-muted">{transcript.contact.email}</div>
              </div>
            )}

            {!transcript.opportunity && !transcript.lead && !transcript.account && !transcript.contact && (
              <p className="text-sm text-muted">No CRM entities linked yet. Entity resolution runs automatically during processing.</p>
            )}
          </div>

          {/* Processing Status */}
          {transcript.processingError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-1">Processing Error</h3>
              <p className="text-xs text-red-600">{transcript.processingError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
