"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { WorkspaceType } from "@/types";
import { WORKSPACE_CONFIG } from "@/lib/constants";

const WORKSPACE_ICONS: Record<WorkspaceType, React.ReactNode> = {
  [WorkspaceType.SDR]: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.05 5A7 7 0 0 1 17 10c0 3.87-3.13 7-7 7s-7-3.13-7-7a7 7 0 0 1 1.95-4.85" />
      <path d="M10 3v7l4 2" />
    </svg>
  ),
  [WorkspaceType.CLOSER]: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <circle cx="10" cy="10" r="5" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  ),
  [WorkspaceType.MANAGER]: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="8" cy="5" r="3" />
      <path d="M18 16v-1a3 3 0 0 0-2.5-2.96" />
      <path d="M14.5 2.04a3 3 0 0 1 0 5.92" />
    </svg>
  ),
  [WorkspaceType.EXECUTIVE]: (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="16" height="12" rx="1" />
      <path d="M6 16V4l4 3 4-3v12" />
    </svg>
  ),
};

export function WorkspaceSwitcher() {
  const { workspace, setWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = WORKSPACE_CONFIG[workspace];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-hover"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-light text-primary">
          {WORKSPACE_ICONS[workspace]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {current.label}
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface py-1 shadow-lg">
          {Object.values(WorkspaceType).map((ws) => {
            const config = WORKSPACE_CONFIG[ws];
            const isActive = ws === workspace;
            return (
              <button
                key={ws}
                type="button"
                onClick={() => {
                  setWorkspace(ws);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-primary-light"
                    : "hover:bg-sidebar-hover"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    isActive
                      ? "bg-primary text-white"
                      : "bg-background text-muted"
                  }`}
                >
                  {WORKSPACE_ICONS[ws]}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {config.label}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {config.description}
                  </p>
                </div>
                {isActive && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-primary"
                  >
                    <path d="m5 10 4 4 6-8" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
