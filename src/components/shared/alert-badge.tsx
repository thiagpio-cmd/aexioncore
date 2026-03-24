"use client";

interface AlertBadgeProps {
  count: number;
  severity?: "critical" | "warning" | "info";
}

const severityClasses: Record<string, string> = {
  critical: "bg-danger text-white",
  warning: "bg-warning text-white",
  info: "bg-primary text-white",
};

export function AlertBadge({ count, severity = "info" }: AlertBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${severityClasses[severity]} ${severity === "critical" ? "animate-pulse" : ""}`}
    >
      {count}
    </span>
  );
}
