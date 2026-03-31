"use client";

import { cn } from "@/lib/utils";

type StatusType = "idle" | "active" | "success" | "danger" | "warning";
type DotSize = "sm" | "md" | "lg";

interface StatusDotProps {
  status: StatusType;
  size?: DotSize;
  pulse?: boolean;
}

const statusColors: Record<StatusType, string> = {
  idle: "bg-[var(--status-idle)]",
  active: "bg-[var(--status-active)]",
  success: "bg-[var(--status-success)]",
  danger: "bg-[var(--status-danger)]",
  warning: "bg-[var(--accent-gold)]",
};

const sizeStyles: Record<DotSize, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2.5 w-2.5",
  lg: "h-3.5 w-3.5",
};

export function StatusDot({ status, size = "md", pulse = false }: StatusDotProps) {
  return (
    <span className="relative inline-flex">
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-75 animate-status-pulse",
            statusColors[status]
          )}
        />
      )}
      <span
        className={cn(
          "relative rounded-full",
          statusColors[status],
          sizeStyles[size]
        )}
      />
    </span>
  );
}
