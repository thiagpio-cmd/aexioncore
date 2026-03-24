"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function SettingsPipelinesPage() {
  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Settings
      </Link>
      <PageHeader
        title="Pipelines"
        description="Configure deal stages and workflows"
        actions={
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            + New Pipeline
          </button>
        }
      />
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        }
        title="Pipeline configuration coming soon"
        description="Create custom pipelines with configurable stages, automations, and win/loss reasons. This settings module is coming in a future phase."
      />
    </div>
  );
}
