"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { WorkspaceType } from "@/types";
import { SDRWorkspace } from "@/components/workspaces/sdr-workspace";
import { CloserWorkspace } from "@/components/workspaces/closer-workspace";
import { ManagerWorkspace } from "@/components/workspaces/manager-workspace";
import { ExecutiveWorkspace } from "@/components/workspaces/executive-workspace";
import { SetupWizard, isOnboardingComplete } from "@/components/onboarding/setup-wizard";
import { SetupProgressBanner } from "@/components/onboarding/progress-banner";
import { MoneyAtRiskWidget } from "@/components/MoneyAtRiskWidget";
import { DebriefModal } from "@/components/DebriefModal";

export default function HomePage() {
  const { workspace } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefOppId, setDebriefOppId] = useState("");

  useEffect(() => {
    const done = isOnboardingComplete();
    setOnboardingDone(done);
    if (!done) {
      setShowWizard(true);
    }
  }, []);

  function handleWizardComplete() {
    setShowWizard(false);
    setOnboardingDone(true);
  }

  function handleResumeSetup() {
    setShowWizard(true);
  }

  const workspaceContent = (() => {
    switch (workspace) {
      case WorkspaceType.SDR:
        return <SDRWorkspace />;
      case WorkspaceType.CLOSER:
        return <CloserWorkspace />;
      case WorkspaceType.MANAGER:
        return <ManagerWorkspace />;
      case WorkspaceType.EXECUTIVE:
        return <ExecutiveWorkspace />;
      default:
        return <SDRWorkspace />;
    }
  })();

  return (
    <>
      {showWizard && <SetupWizard onComplete={handleWizardComplete} />}
      {!onboardingDone && !showWizard && (
        <SetupProgressBanner onResumeSetup={handleResumeSetup} />
      )}

      {/* Dinheiro em Risco — visao geral do dashboard */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <MoneyAtRiskWidget />
        </div>
        <div className="flex items-start justify-end">
          <button
            onClick={() => {
              setDebriefOppId("");
              setShowDebrief(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Novo Debrief
          </button>
        </div>
      </div>

      {workspaceContent}

      <DebriefModal
        open={showDebrief}
        onClose={() => setShowDebrief(false)}
        opportunityId={debriefOppId}
      />
    </>
  );
}
