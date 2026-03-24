"use client";

import { PageHeader } from "@/components/shared/page-header";

const PLANS = [
  { name: "Starter", price: "R$299", period: "/mês", features: ["5 usuários", "1.000 leads", "Email básico", "Relatórios padrão"], current: false },
  { name: "Professional", price: "R$799", period: "/mês", features: ["25 usuários", "10.000 leads", "Inbox unificado", "AI Insights", "Integrações"], current: true },
  { name: "Enterprise", price: "Custom", period: "", features: ["Usuários ilimitados", "Leads ilimitados", "SSO/SAML", "SLA dedicado", "API completa", "Onboarding"], current: false },
];

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Plans" description="Manage your subscription and payment methods" />

      {/* Current Plan */}
      <div className="rounded-xl border border-primary/20 bg-primary-light p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Current Plan</p>
            <p className="text-xl font-bold text-foreground mt-1">Professional</p>
            <p className="text-sm text-muted mt-0.5">Renews on April 1, 2026 · R$799/mês</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Usage this period</p>
            <p className="text-lg font-bold text-foreground">7 / 25 users</p>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-5 ${plan.current ? "border-primary bg-surface shadow-sm" : "border-border bg-surface"}`}
          >
            {plan.current && (
              <span className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">Current</span>
            )}
            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-2xl font-bold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted">{plan.period}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                plan.current
                  ? "border border-border text-muted cursor-default"
                  : "bg-primary text-white hover:bg-primary-hover"
              }`}
              disabled={plan.current}
            >
              {plan.current ? "Current Plan" : plan.price === "Custom" ? "Contact Sales" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Method */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Payment Method</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-background border border-border text-xs font-bold text-muted">VISA</div>
            <div>
              <p className="text-sm font-medium text-foreground">Visa ending in 4242</p>
              <p className="text-xs text-muted">Expires 12/2027</p>
            </div>
          </div>
          <button className="text-sm text-primary hover:underline">Update</button>
        </div>
      </div>

      {/* Invoice History */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Invoice History</h3>
        <div className="space-y-2">
          {[
            { date: "Mar 1, 2026", amount: "R$799,00", status: "Paid" },
            { date: "Feb 1, 2026", amount: "R$799,00", status: "Paid" },
            { date: "Jan 1, 2026", amount: "R$799,00", status: "Paid" },
          ].map((inv) => (
            <div key={inv.date} className="flex items-center justify-between rounded-lg bg-background px-4 py-2.5">
              <span className="text-sm text-foreground">{inv.date}</span>
              <span className="text-sm font-medium text-foreground">{inv.amount}</span>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">{inv.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
