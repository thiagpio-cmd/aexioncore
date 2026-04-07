"use client";

import { useState, useEffect, useRef } from "react";

interface AIInsightBannerProps {
  /** The context prompt sent to the AI (e.g. "Analyze my pipeline" or "Daily briefing") */
  prompt: string;
  /** Optional CSS class */
  className?: string;
  /** Auto-load on mount? Default true */
  autoLoad?: boolean;
  /** Compact mode (single line) vs full mode */
  compact?: boolean;
}

interface AIResponse {
  message: string;
  suggestions?: { label: string; action: string }[];
}

export function AIInsightBanner({
  prompt,
  className = "",
  autoLoad = true,
  compact = false,
}: AIInsightBannerProps) {
  const [insight, setInsight] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!autoLoad) return;
    loadInsight();
    return () => { abortRef.current?.abort(); };
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInsight() {
    setLoading(true);
    setError(false);
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("AI request failed");
      const json = await res.json();
      if (json.success && json.data) {
        setInsight(json.data);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (dismissed || error) return null;

  if (loading) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 ${className}`}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted">Aexion AI analyzing...</span>
      </div>
    );
  }

  if (!insight) return null;

  if (compact) {
    // Single-line banner with dismiss
    const firstLine = insight.message.split("\n")[0].replace(/\*\*/g, "").substring(0, 200);
    return (
      <div className={`flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 ${className}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-primary">
          <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" opacity="0.3" />
          <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="flex-1 text-xs text-foreground truncate">{firstLine}</p>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-muted hover:text-foreground transition-colors p-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Full insight card
  return (
    <div className={`rounded-xl border border-primary/20 bg-primary/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary">
            <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" opacity="0.3" />
            <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Aexion AI — Insight
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted hover:text-foreground transition-colors p-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div
          className="text-sm text-foreground leading-relaxed prose-sm [&_strong]:font-semibold [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{
            __html: insight.message
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\n/g, "<br/>")
              .replace(/• /g, "• "),
          }}
        />
      </div>

      {/* Suggestion chips */}
      {insight.suggestions && insight.suggestions.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {insight.suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                // Open AI chat and send the action
                const event = new CustomEvent("aexion-ai-send", { detail: s.action });
                window.dispatchEvent(event);
              }}
              className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20
                text-primary hover:bg-primary/10 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
