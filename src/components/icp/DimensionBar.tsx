"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DimensionBarProps {
  label: string;
  value: number;
  maxValue?: number;
  variant?: "accent" | "success" | "warning" | "danger" | "info" | "muted";
}

const VARIANT_COLORS: Record<string, string> = {
  accent: "bg-[var(--accent,#2457FF)]",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-400",
  muted: "bg-gray-400",
};

export function DimensionBar({
  label,
  value,
  maxValue = 100,
  variant = "accent",
}: DimensionBarProps) {
  const [animated, setAnimated] = useState(false);
  const pct = Math.min(100, Math.max(0, (value / maxValue) * 100));

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <span className="w-[140px] shrink-0 text-xs text-[var(--text-muted,#888)] truncate">
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-[var(--border-subtle,rgba(255,255,255,0.06))] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            VARIANT_COLORS[variant]
          )}
          style={{ width: animated ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-[var(--text-primary,#fff)]">
        {Math.round(value)}
      </span>
    </div>
  );
}
