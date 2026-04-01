"use client";

import { useCallback, useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { GlassCard } from "@/components/design-system/GlassCard";
import { BigFiveRadar } from "./BigFiveRadar";
import { ArchetypeBadge } from "./ArchetypeBadge";
import { DimensionBar } from "./DimensionBar";

interface CustomerProfileCardProps {
  contactId: string;
  contactName?: string;
  compact?: boolean;
  onClose?: () => void;
}

interface ProfileData {
  profile: {
    id: string;
    bigFive: {
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    } | null;
    jungArchetype: string | null;
    valueSensitivity: {
      functional: number;
      emotional: number;
      social: number;
      epistemic: number;
      conditional: number;
    } | null;
    motivationProfile: {
      autonomy: number;
      competence: number;
      relatedness: number;
    } | null;
    conditioningProfile: {
      rewardSensitivity: number;
      lossAversion: number;
      habituationRate: number;
    } | null;
    fomapScore: number | null;
    lifestyle: {
      interests: string[];
      values: string[];
      priorities: string[];
    } | null;
    confidence: number | null;
  };
  contact: { id: string; name: string };
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--border-subtle)] ${className ?? ""}`}
    />
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 p-4">
      <SkeletonBlock className="h-5 w-48" />
      <SkeletonBlock className="h-[200px] w-full" />
      <SkeletonBlock className="h-8 w-32" />
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-3/4" />
      </div>
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-full" />
      </div>
    </div>
  );
}

function FomapGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 70
      ? "text-emerald-400"
      : clamped >= 40
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${clamped} ${100 - clamped}`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}
        >
          {Math.round(clamped)}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          FOMAP Score
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Motivation x Ability x Prompt
        </p>
      </div>
    </div>
  );
}

function TagChips({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--text-muted)] mb-1.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-block rounded-full border border-[var(--border-subtle)] bg-[var(--glass-bg)] px-2.5 py-0.5 text-xs text-[var(--text-primary)]"
          >
            {item.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
      {children}
    </h4>
  );
}

export function CustomerProfileCard({
  contactId,
  contactName,
  compact = false,
  onClose,
}: CustomerProfileCardProps) {
  const { data, loading, error, refetch } = useApi<ProfileData>(
    `/api/contacts/${contactId}/profile`
  );
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/contacts/${contactId}/profile?refresh=true`);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [contactId, refetch]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-red-400">Error loading profile: {error}</p>
      </GlassCard>
    );
  }

  if (!data?.profile) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-[var(--text-muted)]">
          No profile found for this contact.
        </p>
      </GlassCard>
    );
  }

  const { profile, contact } = data;
  const radarSize = compact ? 200 : 250;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {contactName ?? contact.name}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Psychographic Profile
            {profile.confidence != null && (
              <span className="ml-2">
                &middot; Confidence:{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {Math.round(profile.confidence * 100)}%
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh Profile"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Big Five + Archetype */}
      <GlassCard className="p-4">
        <div className={compact ? "space-y-3" : "flex flex-col lg:flex-row items-center gap-4"}>
          {profile.bigFive && (
            <div className="flex justify-center">
              <BigFiveRadar data={profile.bigFive} size={radarSize} />
            </div>
          )}
          {profile.jungArchetype && (
            <div className="flex flex-col items-center gap-2">
              <SectionTitle>Dominant Archetype</SectionTitle>
              <ArchetypeBadge archetype={profile.jungArchetype} size="lg" />
            </div>
          )}
        </div>
      </GlassCard>

      {/* FOMAP Score */}
      {profile.fomapScore != null && (
        <GlassCard className="p-4">
          <FomapGauge score={profile.fomapScore} />
        </GlassCard>
      )}

      {/* Value Sensitivity */}
      {profile.valueSensitivity && (
        <GlassCard className="p-4">
          <SectionTitle>Value Sensitivity</SectionTitle>
          <div className="space-y-2">
            <DimensionBar label="Functional" value={profile.valueSensitivity.functional} variant="accent" />
            <DimensionBar label="Emotional" value={profile.valueSensitivity.emotional} variant="info" />
            <DimensionBar label="Social" value={profile.valueSensitivity.social} variant="success" />
            <DimensionBar label="Epistemic" value={profile.valueSensitivity.epistemic} variant="warning" />
            <DimensionBar label="Conditional" value={profile.valueSensitivity.conditional} variant="muted" />
          </div>
        </GlassCard>
      )}

      {/* Motivation Profile */}
      {profile.motivationProfile && (
        <GlassCard className="p-4">
          <SectionTitle>Motivation Profile (SDT)</SectionTitle>
          <div className="space-y-2">
            <DimensionBar label="Autonomy" value={profile.motivationProfile.autonomy} variant="accent" />
            <DimensionBar label="Competence" value={profile.motivationProfile.competence} variant="success" />
            <DimensionBar label="Relatedness" value={profile.motivationProfile.relatedness} variant="info" />
          </div>
        </GlassCard>
      )}

      {/* Conditioning Profile */}
      {profile.conditioningProfile && (
        <GlassCard className="p-4">
          <SectionTitle>Conditioning Profile</SectionTitle>
          <div className="space-y-2">
            <DimensionBar
              label="Reward Sensitivity"
              value={profile.conditioningProfile.rewardSensitivity}
              variant="success"
            />
            <DimensionBar
              label="Loss Aversion"
              value={profile.conditioningProfile.lossAversion}
              variant="warning"
            />
            <DimensionBar
              label="Habituation"
              value={profile.conditioningProfile.habituationRate}
              variant="muted"
            />
          </div>
        </GlassCard>
      )}

      {/* Lifestyle */}
      {profile.lifestyle && (
        <GlassCard className="p-4 space-y-3">
          <SectionTitle>Lifestyle</SectionTitle>
          <TagChips title="Interests" items={profile.lifestyle.interests ?? []} />
          <TagChips title="Values" items={profile.lifestyle.values ?? []} />
          <TagChips title="Priorities" items={profile.lifestyle.priorities ?? []} />
        </GlassCard>
      )}
    </div>
  );
}
