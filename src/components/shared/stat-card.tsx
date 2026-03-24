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
    <div className="group rounded-xl border border-border/50 bg-surface p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted tracking-wide">{label}</p>
          <p className="mt-1.5 text-xl font-bold text-foreground tabular-nums truncate">{value}</p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted ml-3">
            {icon}
          </div>
        )}
      </div>
      {change && (
        <p
          className={cn(
            "mt-2 text-[11px] font-medium truncate",
            changeType === "positive" && "text-success",
            changeType === "negative" && "text-danger",
            changeType === "neutral" && "text-muted/70"
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
