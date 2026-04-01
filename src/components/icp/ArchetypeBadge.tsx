"use client";

import { cn } from "@/lib/utils";

type JungArchetype =
  | "hero"
  | "explorer"
  | "sage"
  | "rebel"
  | "magician"
  | "lover"
  | "caregiver"
  | "ruler";

interface ArchetypeBadgeProps {
  archetype: string;
  score?: number;
  size?: "sm" | "md" | "lg";
}

const ARCHETYPE_CONFIG: Record<
  JungArchetype,
  { label: string; emoji: string; color: string; bg: string }
> = {
  hero: {
    label: "Heroi",
    emoji: "\u{1F9B8}",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
  explorer: {
    label: "Explorador",
    emoji: "\u{1F9ED}",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  sage: {
    label: "Sabio",
    emoji: "\u{1F4DA}",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  rebel: {
    label: "Rebelde",
    emoji: "\u{26A1}",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  },
  magician: {
    label: "Mago",
    emoji: "\u{2728}",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
  },
  lover: {
    label: "Amante",
    emoji: "\u{2764}\u{FE0F}",
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/20",
  },
  caregiver: {
    label: "Cuidador",
    emoji: "\u{1F91D}",
    color: "text-teal-400",
    bg: "bg-teal-400/10 border-teal-400/20",
  },
  ruler: {
    label: "Governante",
    emoji: "\u{1F451}",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
  },
};

const SIZE_STYLES = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
  lg: "px-4 py-2 text-base gap-2",
};

const EMOJI_SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function ArchetypeBadge({
  archetype,
  score,
  size = "md",
}: ArchetypeBadgeProps) {
  const key = archetype.toLowerCase() as JungArchetype;
  const config = ARCHETYPE_CONFIG[key] ?? ARCHETYPE_CONFIG.magician;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.bg,
        config.color,
        SIZE_STYLES[size]
      )}
    >
      <span className={EMOJI_SIZE[size]}>{config.emoji}</span>
      <span>{config.label}</span>
      {score != null && (
        <span className="opacity-60 ml-0.5">({Math.round(score)})</span>
      )}
    </span>
  );
}
