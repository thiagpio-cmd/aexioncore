"use client";

import { cn } from "@/lib/utils";

interface ExecutionScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreColor(score: number): {
  text: string;
  bg: string;
  ring: string;
  status: string;
} {
  if (score > 70) {
    return {
      text: "text-[var(--accent-emerald)]",
      bg: "bg-[var(--accent-emerald)]/15",
      ring: "stroke-[var(--accent-emerald)]",
      status: "Bom",
    };
  }
  if (score >= 40) {
    return {
      text: "text-[var(--accent-gold)]",
      bg: "bg-[var(--accent-gold)]/15",
      ring: "stroke-[var(--accent-gold)]",
      status: "Regular",
    };
  }
  return {
    text: "text-[var(--accent-red)]",
    bg: "bg-[var(--accent-red)]/15",
    ring: "stroke-[var(--accent-red)]",
    status: "Critico",
  };
}

const sizeConfig = {
  sm: { outer: 32, strokeWidth: 3, fontSize: "text-[10px]", labelSize: "text-[9px]" },
  md: { outer: 48, strokeWidth: 3.5, fontSize: "text-sm", labelSize: "text-[10px]" },
  lg: { outer: 64, strokeWidth: 4, fontSize: "text-lg", labelSize: "text-xs" },
};

export function ExecutionScoreBadge({
  score,
  size = "md",
  showLabel = false,
}: ExecutionScoreBadgeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const colors = getScoreColor(clampedScore);
  const config = sizeConfig[size];
  const radius = (config.outer - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (clampedScore / 100) * circumference;
  const offset = circumference - progress;

  return (
    <div className="inline-flex flex-col items-center gap-[var(--space-xs)]">
      <div
        className={cn("relative inline-flex items-center justify-center rounded-full", colors.bg)}
        style={{ width: config.outer, height: config.outer }}
      >
        {/* Background ring */}
        <svg
          width={config.outer}
          height={config.outer}
          className="absolute inset-0 -rotate-90"
        >
          <circle
            cx={config.outer / 2}
            cy={config.outer / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            className="stroke-[var(--glass-border)]"
          />
          <circle
            cx={config.outer / 2}
            cy={config.outer / 2}
            r={radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(colors.ring, "transition-all duration-500")}
          />
        </svg>

        {/* Score number */}
        <span
          className={cn(
            "relative font-bold tabular-nums",
            colors.text,
            config.fontSize
          )}
        >
          {clampedScore}
        </span>
      </div>

      {showLabel && (
        <span
          className={cn(
            "font-semibold uppercase tracking-wider",
            colors.text,
            config.labelSize
          )}
        >
          {colors.status}
        </span>
      )}
    </div>
  );
}
