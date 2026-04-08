"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/design-system/GlassCard";
import { SectionLabel } from "@/components/design-system/SectionLabel";

interface SnapshotSection {
  topic: string;
  summary: string;
}

interface MarketSnapshot {
  date: string;
  sections: SnapshotSection[];
  generatedAt: string;
}

const TOPIC_ICONS: Record<string, string> = {
  "Market Trends & Cap Rates": "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "Investment Sales & Deal Volume": "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Financing & Interest Rates": "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5",
  "Sun Belt Markets": "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  "Distressed Assets & Opportunities": "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
};

export function MarketIntelWidget() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market-intelligence")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data.snapshot) {
          setSnapshot(json.data.snapshot);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassCard span={4}>
        <SectionLabel>Market Intelligence</SectionLabel>
        <div style={{ marginTop: "var(--space-md)", display: "flex", gap: "var(--space-md)" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse" style={{ flex: 1, height: 60, borderRadius: "var(--radius-sm)", background: "var(--border-subtle)" }} />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (!snapshot) return null;

  // Show top 3 sections as compact cards
  const topSections = snapshot.sections.slice(0, 3);
  const remaining = snapshot.sections.length - 3;

  return (
    <GlassCard span={4}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <SectionLabel>Market Intelligence</SectionLabel>
        </div>
        <a
          href="/market-intelligence"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--accent)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          View all
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>
      </div>

      <div style={{ marginTop: "var(--space-md)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)" }}>
        {topSections.map((section) => (
          <div
            key={section.topic}
            style={{
              padding: "var(--space-md)",
              borderRadius: "var(--radius-sm)",
              border: "0.5px solid var(--border-subtle)",
              background: "var(--bg-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={TOPIC_ICONS[section.topic] || TOPIC_ICONS["Market Trends & Cap Rates"]} />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {section.topic}
              </span>
            </div>
            <p style={{
              fontSize: "12px",
              lineHeight: "1.5",
              color: "var(--text-tertiary)",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}>
              {section.summary || "No data available yet"}
            </p>
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <p style={{ marginTop: "var(--space-sm)", fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
          +{remaining} more sectors
        </p>
      )}

      <p style={{ marginTop: "var(--space-xs)", fontSize: "10px", color: "var(--text-muted)", textAlign: "right" }}>
        Updated {new Date(snapshot.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
    </GlassCard>
  );
}
