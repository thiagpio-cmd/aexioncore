"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default function SettingsNotificationsPage() {
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
        title="Notifications"
        description="Email and push notification preferences"
      />
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 0 0-5-5Z" />
            <path d="M8 15a2 2 0 1 0 4 0" />
          </svg>
        }
        title="Notification settings coming soon"
        description="Configure which events trigger notifications, choose delivery channels (email, push, in-app), and set quiet hours. Coming in a future phase."
      />
    </div>
  );
}
