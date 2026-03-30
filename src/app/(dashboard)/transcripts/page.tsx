"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

interface Transcript {
  id: string;
  source: string;
  title: string | null;
  summary: string | null;
  sentiment: string | null;
  keyTopics: string | null;
  duration: number | null;
  participants: string | null;
  processedAt: string | null;
  createdAt: string;
  leadId: string | null;
  opportunityId: string | null;
  accountId: string | null;
  contactId: string | null;
}

const SOURCE_ICONS: Record<string, string> = {
  zoom: "🎥",
  google_meet: "📹",
  microsoft_teams: "💻",
  twilio: "📞",
};

const SOURCE_LABELS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  microsoft_teams: "Teams",
  twilio: "Phone Call",
};

const SENTIMENT_BADGES: Record<string, { label: string; class: string }> = {
  positive: { label: "Positive", class: "bg-emerald-50 text-emerald-700" },
  neutral: { label: "Neutral", class: "bg-gray-50 text-gray-600" },
  negative: { label: "Negative", class: "bg-red-50 text-red-700" },
  mixed: { label: "Mixed", class: "bg-amber-50 text-amber-700" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export default function TranscriptsPage() {
  const [sourceFilter, setSourceFilter] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  params.set("limit", "20");
  if (sourceFilter) params.set("source", sourceFilter);
  if (sentimentFilter) params.set("sentiment", sentimentFilter);
  if (search) params.set("search", search);

  const { data, loading } = useApi<Transcript[]>(
    `/api/transcripts?${params.toString()}`
  );

  const transcripts = data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcripts"
        description="Meeting and call transcriptions with AI analysis"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search transcripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none w-64"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          <option value="">All Sources</option>
          <option value="zoom">Zoom</option>
          <option value="google_meet">Google Meet</option>
          <option value="microsoft_teams">Teams</option>
          <option value="twilio">Phone Calls</option>
        </select>
        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          <option value="">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton />
      ) : transcripts.length === 0 ? (
        <EmptyState
          title="No transcripts yet"
          description="Connect Zoom, Google Meet, Microsoft Teams, or Twilio to start receiving meeting transcriptions automatically."
        />
      ) : (
        <div className="space-y-3">
          {transcripts.map((t) => (
            <Link
              key={t.id}
              href={`/transcripts/${t.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0">
                    {SOURCE_ICONS[t.source] || "📄"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {t.title || "Untitled Meeting"}
                      </h3>
                      <span className="text-xs text-muted flex-shrink-0">
                        {SOURCE_LABELS[t.source] || t.source}
                      </span>
                    </div>
                    {t.summary && (
                      <p className="mt-1 text-sm text-muted line-clamp-2">
                        {t.summary}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span>
                        {new Date(t.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {t.duration && <span>{formatDuration(t.duration)}</span>}
                      {!t.processedAt && (
                        <span className="text-amber-600">Processing...</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.sentiment && SENTIMENT_BADGES[t.sentiment] && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SENTIMENT_BADGES[t.sentiment].class}`}
                    >
                      {SENTIMENT_BADGES[t.sentiment].label}
                    </span>
                  )}
                  {t.opportunityId && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Deal
                    </span>
                  )}
                  {t.leadId && !t.opportunityId && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      Lead
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
