"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, changeType = "neutral", icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-muted">
            {icon}
          </div>
        )}
      </div>
      {change && (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            changeType === "positive" && "text-success",
            changeType === "negative" && "text-danger",
            changeType === "neutral" && "text-muted"
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
