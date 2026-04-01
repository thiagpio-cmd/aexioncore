"use client";

import { cn } from "@/lib/utils";

type StatusType = "danger" | "success" | "warning" | "accent" | "neutral";
type DotSize = "sm" | "md" | "lg";

interface StatusDotProps {
  status: StatusType;
  size?: DotSize;
  pulse?: boolean;
  label?: string;
  className?: string;
}

const statusColorVars: Record<StatusType, string> = {
  danger: "var(--color-danger)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  accent: "var(--accent)",
  neutral: "var(--text-muted)",
};

const dotSizeVars: Record<DotSize, string> = {
  sm: "var(--dot-sm)",
  md: "var(--dot-md)",
  lg: "var(--dot-lg)",
};

export function StatusDot({
  status,
  size = "md",
  pulse = false,
  label,
  className,
}: StatusDotProps) {
  const color = statusColorVars[status];
  const dotSize = dotSizeVars[size];

  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: "var(--space-sm)" }}
    >
      <span className="relative inline-flex">
        {pulse && (
          <span
            className="absolute inset-0 rounded-full animate-status-pulse"
            style={{
              backgroundColor: color,
              opacity: 0.75,
            }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
          }}
        />
      </span>
      {label && (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: color,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
