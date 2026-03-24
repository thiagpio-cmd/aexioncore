"use client";

import { cn } from "@/lib/utils";

interface HealthBadgeProps {
  score: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function HealthBadge({ score, size = "sm", showLabel = true }: HealthBadgeProps) {
  const color =
    score >= 70 ? "text-success bg-success-light" :
    score >= 40 ? "text-warning bg-warning-light" :
    "text-danger bg-danger-light";

  const label =
    score >= 70 ? "Healthy" :
    score >= 40 ? "At Risk" :
    "Critical";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        color,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      <span className={cn(
        "rounded-full",
        score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-danger",
        size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2"
      )} />
      {showLabel ? label : `${score}%`}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "outline";
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  QUALIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNQUALIFIED: "bg-gray-50 text-gray-600 border-gray-200",
  CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
  CONNECTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISCONNECTED: "bg-gray-50 text-gray-500 border-gray-200",
  ERROR: "bg-red-50 text-red-700 border-red-200",
  SYNCING: "bg-blue-50 text-blue-700 border-blue-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  RETRYING: "bg-amber-50 text-amber-700 border-amber-200",
  HOT: "bg-red-50 text-red-700 border-red-200",
  WARM: "bg-amber-50 text-amber-700 border-amber-200",
  COLD: "bg-blue-50 text-blue-700 border-blue-200",
  LOW: "bg-gray-50 text-gray-600 border-gray-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  URGENT: "bg-red-50 text-red-700 border-red-200",
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-50 text-gray-600 border-gray-200";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "outline" ? "border " + colorClass : colorClass
      )}
    >
      {label}
    </span>
  );
}
