"use client";

import { cn } from "@/lib/utils";

type GlassCardVariant = "default" | "elevated" | "interactive";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: GlassCardVariant;
  onClick?: () => void;
}

const variantStyles: Record<GlassCardVariant, string> = {
  default: [
    "bg-[var(--glass-bg)]",
    "border border-[var(--glass-border)]",
    "backdrop-blur-[var(--glass-blur)]",
  ].join(" "),
  elevated: [
    "bg-[var(--surface-elevated)]",
    "border border-[var(--glass-border)]",
    "backdrop-blur-[var(--glass-blur)]",
    "shadow-lg shadow-black/20",
  ].join(" "),
  interactive: [
    "bg-[var(--glass-bg)]",
    "border border-[var(--glass-border)]",
    "backdrop-blur-[var(--glass-blur)]",
    "cursor-pointer",
    "transition-all duration-200",
    "hover:bg-[rgba(255,255,255,0.05)]",
    "hover:border-[rgba(255,255,255,0.1)]",
    "hover:shadow-lg hover:shadow-black/10",
    "active:scale-[0.99]",
  ].join(" "),
};

export function GlassCard({
  children,
  className,
  variant = "default",
  onClick,
}: GlassCardProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={cn(
        "rounded-[var(--radius-md)] p-[var(--space-md)]",
        variantStyles[variant],
        className
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}
