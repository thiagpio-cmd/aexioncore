"use client";

import { useState, useEffect } from "react";

const ONBOARDING_KEY = "aexion_onboarding_complete";
const ONBOARDING_STEP_KEY = "aexion_onboarding_step";

interface SetupWizardProps {
  onComplete: () => void;
}

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Aexion Core",
    description: "Your all-in-one CRM platform is ready. Let\u2019s get you set up in just a few steps.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 7L23 12V20L16 25L9 20V12L16 7Z" fill="currentColor" fillOpacity="0.15" />
        <path d="M16 12L19.5 14.5V19L16 21.5L12.5 19V14.5L16 12Z" fill="currentColor" />
      </svg>
    ),
    cta: "Get Started",
  },
  {
    id: "email",
    title: "Connect Your Email",
    description: "Sync your email to automatically log conversations and track engagement with your contacts.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 7L2 7" />
      </svg>
    ),
    cta: "Connect Email",
  },
  {
    id: "import",
    title: "Import Your Data",
    description: "Bring in your existing contacts, leads, and deals from a CSV file or another CRM.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    cta: "Import Data",
  },
  {
    id: "team",
    title: "Invite Your Team",
    description: "Collaboration is key. Invite team members so everyone stays aligned on deals and tasks.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    cta: "Invite Team",
  },
  {
    id: "ready",
    title: "You\u2019re All Set!",
    description: "Your workspace is ready. Start managing leads, closing deals, and growing your pipeline.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
    cta: "Go to Dashboard",
  },
];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (done === "true") {
      onComplete();
      return;
    }
    const savedStep = localStorage.getItem(ONBOARDING_STEP_KEY);
    if (savedStep) setCurrentStep(Number(savedStep));
    setVisible(true);
  }, [onComplete]);

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  function handleNext() {
    if (isLast) {
      localStorage.setItem(ONBOARDING_KEY, "true");
      localStorage.removeItem(ONBOARDING_STEP_KEY);
      setVisible(false);
      onComplete();
    } else {
      const next = currentStep + 1;
      setCurrentStep(next);
      localStorage.setItem(ONBOARDING_STEP_KEY, String(next));
    }
  }

  function handleSkip() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    setVisible(false);
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 animate-scale-in rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 w-full bg-border/40">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-8">
          {/* Step indicator */}
          <div className="mb-6 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-6 bg-primary"
                    : i < currentStep
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
              {step.icon}
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={handleNext}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
            >
              {step.cta}
            </button>

            {!isLast && (
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSkip}
                  className="text-xs font-medium text-muted transition-colors hover:text-foreground"
                >
                  Skip setup
                </button>
                <span className="text-xs text-muted/60">
                  Step {currentStep + 1} of {STEPS.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Check if onboarding is complete */
export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

/** Get steps completed count (for progress banner) */
export function getOnboardingProgress(): { completed: number; total: number } {
  if (typeof window === "undefined") return { completed: 0, total: STEPS.length };
  if (localStorage.getItem(ONBOARDING_KEY) === "true") {
    return { completed: STEPS.length, total: STEPS.length };
  }
  const step = localStorage.getItem(ONBOARDING_STEP_KEY);
  return { completed: step ? Number(step) : 0, total: STEPS.length };
}
