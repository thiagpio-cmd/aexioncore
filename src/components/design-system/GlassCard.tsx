"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  accent?: boolean;
  success?: boolean;
  danger?: boolean;
  span?: number;
  rowSpan?: number;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  elevated = false,
  accent = false,
  success = false,
  danger = false,
  span,
  rowSpan,
  onClick,
}: GlassCardProps) {
  const Component = onClick ? "button" : "div";

  const bgColor = success
    ? "var(--color-success-muted)"
    : danger
    ? "var(--color-danger-muted)"
    : elevated
    ? "var(--bg-card-elevated)"
    : "var(--bg-card)";

  const borderColor = success
    ? "var(--color-success-border)"
    : danger
    ? "var(--color-danger-border)"
    : "var(--border-subtle)";

  const gridStyles: React.CSSProperties = {};
  if (span) gridStyles.gridColumn = `span ${span}`;
  if (rowSpan) gridStyles.gridRow = `span ${rowSpan}`;

  return (
    <Component
      className={cn(
        "relative text-left",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        background: bgColor,
        border: `0.5px solid ${borderColor}`,
        borderRadius: "var(--radius-lg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        padding: "var(--space-xl)",
        transition: "border-color var(--transition-default), background-color var(--transition-default)",
        ...gridStyles,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = borderColor;
        }
      }}
    >
      {/* Hairline top gradient */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: "1px",
          background: accent
            ? `linear-gradient(90deg, transparent, var(--accent-glow), transparent)`
            : "var(--glass-hairline-subtle)",
          pointerEvents: "none",
        }}
      />
      {children}
    </Component>
  );
}
