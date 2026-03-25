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

export default function HomePage() {
  const { workspace } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);

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
      {workspaceContent}
    </>
  );
}
