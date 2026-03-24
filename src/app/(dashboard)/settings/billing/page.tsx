"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useOrg } from "@/lib/org-context";

export default function BillingPage() {
  const { org } = useOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Billing & Subscription" description="Manage your plan and payment details" />

      {/* Current Status */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Current Plan</p>
            <p className="text-xl font-bold text-foreground mt-1">Early Access</p>
            <p className="text-sm text-muted mt-0.5">{org.displayName || org.name || "Your organization"}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Subscription Management</h3>
        <p className="text-sm text-muted leading-relaxed">
          Billing management with plan tiers, payment processing, and invoice history will be available when the platform launches commercially. During early access, all features are available without charge.
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-background px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm text-muted">Full access included in your current plan</span>
        </div>
      </div>
    </div>
  );
}
