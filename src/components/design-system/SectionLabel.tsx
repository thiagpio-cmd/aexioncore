"use client";

import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function SectionLabel({ children, className, action }: SectionLabelProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        {children}
      </span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--accent-text)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "opacity var(--transition-default)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.7";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
