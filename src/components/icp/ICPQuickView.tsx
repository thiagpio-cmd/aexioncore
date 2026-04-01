"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CustomerProfileCard } from "./CustomerProfileCard";

interface ICPQuickViewProps {
  contactId: string;
  contactName?: string;
  size?: "sm" | "md";
}

export function ICPQuickView({
  contactId,
  contactName,
  size = "sm",
}: ICPQuickViewProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const iconSize = size === "sm" ? 16 : 20;
  const btnClass =
    size === "sm"
      ? "h-7 w-7 rounded-md"
      : "h-9 w-9 rounded-lg";

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        onClick={toggle}
        title="Ver perfil psicografico"
        className={`${btnClass} inline-flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--accent)]`}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Brain icon */}
          <path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z" />
          <path d="M9 21h6M10 17v4M14 17v4" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50 bg-black/50" onClick={close} />
          {/* Modal content */}
          <div className="fixed inset-4 z-50 mx-auto max-w-lg overflow-y-auto rounded-xl border border-[var(--glass-border)] bg-[var(--bg-card-elevated)] p-4 shadow-2xl lg:inset-auto lg:right-4 lg:top-4 lg:bottom-4 lg:left-auto lg:w-[480px]">
            <CustomerProfileCard
              contactId={contactId}
              contactName={contactName}
              onClose={close}
            />
          </div>
        </>
      )}
    </div>
  );
}
