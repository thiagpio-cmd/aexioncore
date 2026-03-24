"use client";

import { useApi } from "@/lib/hooks/use-api";
import { ModuleGuard } from "@/components/shared/module-guard";
import Link from "next/link";

export default function ConsultingModulePage() {
  return <ModuleGuard moduleKey="commercial"><ConsultingContent /></ModuleGuard>;
}

function ConsultingContent() {
  const { data: reports } = useApi<any[]>("/api/reports");
  const { data: playbooks } = useApi<any[]>("/api/playbooks");
  const { data: insights } = useApi<any[]>("/api/insights");

  const reportCount = reports?.length ?? 0;
  const playbookCount = playbooks?.length ?? 0;
  const insightCount = insights?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Consulting Module</h1>
        <p className="text-sm text-muted mt-1">Strategic analysis, playbooks, reports, and diagnostic intelligence</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/reports" className="rounded-xl border border-border bg-surface p-5 hover:border-primary transition-colors">
          <h3 className="font-semibold">Reports</h3>
          <p className="text-3xl font-bold mt-2">{reportCount}</p>
          <p className="text-sm text-muted mt-1">Generated reports available</p>
          <p className="text-xs text-primary mt-3">View Reports →</p>
        </Link>
        <Link href="/playbooks" className="rounded-xl border border-border bg-surface p-5 hover:border-primary transition-colors">
          <h3 className="font-semibold">Playbooks</h3>
          <p className="text-3xl font-bold mt-2">{playbookCount}</p>
          <p className="text-sm text-muted mt-1">Active sales playbooks</p>
          <p className="text-xs text-primary mt-3">View Playbooks →</p>
        </Link>
        <Link href="/insights" className="rounded-xl border border-border bg-surface p-5 hover:border-primary transition-colors">
          <h3 className="font-semibold">Insights</h3>
          <p className="text-3xl font-bold mt-2">{insightCount}</p>
          <p className="text-sm text-muted mt-1">AI-generated insights</p>
          <p className="text-xs text-primary mt-3">View Insights →</p>
        </Link>
      </div>

      {/* Strategic Surfaces */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold mb-4">Strategic Analysis Surfaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/data/personas" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-background transition-colors">
            <span className="text-lg">👤</span>
            <div>
              <p className="text-sm font-medium">Personas & Fit</p>
              <p className="text-xs text-muted">Lead qualification and persona analysis</p>
            </div>
          </Link>
          <Link href="/data/objections" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-background transition-colors">
            <span className="text-lg">🛡</span>
            <div>
              <p className="text-sm font-medium">Objection Analysis</p>
              <p className="text-xs text-muted">Common objections and handling strategies</p>
            </div>
          </Link>
          <Link href="/data/conversion" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-background transition-colors">
            <span className="text-lg">📊</span>
            <div>
              <p className="text-sm font-medium">Conversion Funnel</p>
              <p className="text-xs text-muted">Stage velocity and stall analysis</p>
            </div>
          </Link>
          <Link href="/data/post-sale" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-background transition-colors">
            <span className="text-lg">🔄</span>
            <div>
              <p className="text-sm font-medium">Post-Sale Intelligence</p>
              <p className="text-xs text-muted">Churn, retention, and onboarding analysis</p>
            </div>
          </Link>
          <Link href="/data/team-performance" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-background transition-colors">
            <span className="text-lg">👥</span>
            <div>
              <p className="text-sm font-medium">Team Performance</p>
              <p className="text-xs text-muted">Rep productivity and weak-link visibility</p>
            </div>
          </Link>
          <Link href="/forecast" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-background transition-colors">
            <span className="text-lg">📈</span>
            <div>
              <p className="text-sm font-medium">Forecast & Revenue</p>
              <p className="text-xs text-muted">Revenue projection and pipeline coverage</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
