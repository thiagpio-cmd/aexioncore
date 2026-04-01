"use client";

import { cn } from "@/lib/utils";

interface BentoGridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: string;
  className?: string;
}

export function BentoGrid({
  children,
  columns = 4,
  gap = "10px",
  className,
}: BentoGridProps) {
  return (
    <div
      className={cn("bento-grid", className)}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      <style>{`
        @media (max-width: 1200px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .bento-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
