"use client";

import { useOrg } from "@/lib/org-context";

type LogoVariant = "full" | "mark";
type LogoSize = "sm" | "md" | "lg";

interface BrandLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const sizeMap: Record<LogoSize, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

const fontSizeMap: Record<LogoSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
};

export function BrandLogo({ variant = "full", size = "md", className }: BrandLogoProps) {
  const { org } = useOrg();
  const maxHeight = sizeMap[size];
  const logoUrl = variant === "mark"
    ? ((org as Record<string, unknown>).brandLogoMarkUrl as string | undefined) || org.logoUrl
    : org.logoUrl;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={org.displayName || org.name || "Logo"}
        className={className}
        style={{
          maxHeight: `${maxHeight}px`,
          width: "auto",
          objectFit: "contain",
        }}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--accent-text)",
        fontSize: `${fontSizeMap[size]}px`,
        lineHeight: `${maxHeight}px`,
        userSelect: "none",
      }}
    >
      {variant === "mark"
        ? (org.displayName || org.name || "AX").substring(0, 2).toUpperCase()
        : (org.displayName || org.name || "AEXION").toUpperCase()}
    </span>
  );
}
