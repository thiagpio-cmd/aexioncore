"use client";

import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem {
  label: string;
  href: string;
}

interface TopNavProps {
  items?: NavItem[];
  className?: string;
  onSearch?: () => void;
}

const defaultItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Contatos", href: "/contacts" },
  { label: "Relatorios", href: "/reports" },
];

export function TopNav({ items = defaultItems, className, onSearch }: TopNavProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const userName = user?.name || "User";
  const initials = getInitials(userName);

  return (
    <nav
      className={cn("flex items-center justify-between", className)}
      style={{
        padding: "0 var(--space-xl)",
        height: "48px",
        borderBottom: "0.5px solid var(--border-subtle)",
      }}
    >
      {/* Left: Logo + Nav items */}
      <div className="flex items-center" style={{ gap: "var(--space-xl)" }}>
        <BrandLogo variant="full" size="sm" />
        <div className="flex items-center" style={{ gap: "var(--space-lg)" }}>
          {items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: "13px",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-ghost)",
                  borderBottom: isActive ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                  paddingBottom: "2px",
                  transition: "color var(--transition-default), border-color var(--transition-default)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-ghost)";
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right: Search + Avatar */}
      <div className="flex items-center" style={{ gap: "var(--space-md)" }}>
        {/* Search pill */}
        <button
          onClick={onSearch}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "var(--space-xs) var(--space-md)",
            borderRadius: "var(--radius-full)",
            border: "0.5px solid var(--border-subtle)",
            background: "var(--bg-card)",
            color: "var(--text-ghost)",
            fontSize: "12px",
            cursor: "pointer",
            transition: "border-color var(--transition-default)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Buscar
        </button>

        {/* User avatar */}
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "var(--accent-muted)",
            border: "1px solid var(--accent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--accent-text)",
            cursor: "pointer",
          }}
          title={userName}
        >
          {initials}
        </div>
      </div>
    </nav>
  );
}
