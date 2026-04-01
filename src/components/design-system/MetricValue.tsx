"use client";

import { cn } from "@/lib/utils";

type MetricSize = "hero" | "large" | "medium" | "small";
type SubtitleColor = "success" | "danger" | "warning" | "muted";

interface MetricValueProps {
  value: string | number;
  label: string;
  subtitle?: string;
  subtitleColor?: SubtitleColor;
  prefix?: string;
  size?: MetricSize;
  className?: string;
}

const sizeStyles: Record<MetricSize, { fontSize: string; fontWeight: number; letterSpacing: string }> = {
  hero: { fontSize: "46px", fontWeight: 300, letterSpacing: "-0.03em" },
  large: { fontSize: "28px", fontWeight: 300, letterSpacing: "-0.02em" },
  medium: { fontSize: "22px", fontWeight: 400, letterSpacing: "0" },
  small: { fontSize: "20px", fontWeight: 400, letterSpacing: "0" },
};

const subtitleColorVars: Record<SubtitleColor, string> = {
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  muted: "var(--text-muted)",
};

export function MetricValue({
  value,
  label,
  subtitle,
  subtitleColor = "muted",
  prefix,
  size = "medium",
  className,
}: MetricValueProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("flex flex-col", className)} style={{ gap: "var(--space-xs)" }}>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <div className="flex items-baseline" style={{ gap: "var(--space-sm)" }}>
        <p
          style={{
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            letterSpacing: styles.letterSpacing,
            color: "var(--text-primary)",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
          }}
        >
          {prefix && (
            <span style={{ color: "var(--text-secondary)" }}>{prefix}</span>
          )}
          {value}
        </p>
      </div>
      {subtitle && (
        <span
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: subtitleColorVars[subtitleColor],
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
