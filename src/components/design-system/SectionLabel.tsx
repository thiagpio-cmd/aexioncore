"use client";

import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]",
        className
      )}
    >
      {children}
    </span>
  );
}
