"use client";

import { useAuth } from "@/lib/auth-context";
import { WorkspaceType } from "@/types";
import { SDRWorkspace } from "@/components/workspaces/sdr-workspace";
import { CloserWorkspace } from "@/components/workspaces/closer-workspace";
import { ManagerWorkspace } from "@/components/workspaces/manager-workspace";
import { ExecutiveWorkspace } from "@/components/workspaces/executive-workspace";

export default function HomePage() {
  const { workspace } = useAuth();

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
}
