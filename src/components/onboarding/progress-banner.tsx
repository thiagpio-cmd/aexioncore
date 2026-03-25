"use client";

import { useState, useEffect } from "react";
import { getOnboardingProgress, isOnboardingComplete } from "./setup-wizard";

interface ProgressBannerProps {
  onResumeSetup: () => void;
}

const BANNER_DISMISSED_KEY = "aexion_setup_banner_dismissed";

export function SetupProgressBanner({ onResumeSetup }: ProgressBannerProps) {
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (isOnboardingComplete()) return;
    if (localStorage.getItem(BANNER_DISMISSED_KEY) === "true") return;

    const progress = getOnboardingProgress();
    const stepsRemaining = progress.total - progress.completed;
    if (stepsRemaining > 0) {
      setRemaining(stepsRemaining);
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    setVisible(false);
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary-light px-4 py-3 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <p className="text-sm text-foreground">
          <span className="font-semibold">{remaining} step{remaining !== 1 ? "s" : ""} remaining</span>
          <span className="text-muted"> to complete your setup</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onResumeSetup}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
        >
          Complete Setup
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1.5 text-muted hover:bg-background/60 hover:text-foreground transition-colors"
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
