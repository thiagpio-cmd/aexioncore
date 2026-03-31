"use client";

import { cn } from "@/lib/utils";

type TrendDirection = "up" | "down" | "stable";
type MetricSize = "sm" | "md" | "lg";

interface MetricValueProps {
  value: string | number;
  label: string;
  trend?: TrendDirection;
  prefix?: string;
  size?: MetricSize;
}

const sizeStyles: Record<MetricSize, { value: string; label: string }> = {
  sm: { value: "text-xl font-bold", label: "text-[11px]" },
  md: { value: "text-3xl font-bold", label: "text-xs" },
  lg: { value: "text-5xl font-extrabold", label: "text-sm" },
};

const trendConfig: Record<TrendDirection, { icon: string; color: string }> = {
  up: { icon: "\u2191", color: "text-[var(--accent-emerald)]" },
  down: { icon: "\u2193", color: "text-[var(--accent-red)]" },
  stable: { icon: "\u2192", color: "text-[var(--text-muted)]" },
};

export function MetricValue({
  value,
  label,
  trend,
  prefix,
  size = "md",
}: MetricValueProps) {
  const styles = sizeStyles[size];

  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <p
        className={cn(
          "font-medium uppercase tracking-wider text-[var(--text-muted)]",
          styles.label
        )}
      >
        {label}
      </p>
      <div className="flex items-baseline gap-[var(--space-sm)]">
        <p
          className={cn(
            "tabular-nums text-[var(--text-primary)]",
            styles.value
          )}
        >
          {prefix && (
            <span className="text-[var(--text-secondary)]">{prefix}</span>
          )}
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              "text-sm font-medium",
              trendConfig[trend].color
            )}
          >
            {trendConfig[trend].icon}
          </span>
        )}
      </div>
    </div>
  );
}
