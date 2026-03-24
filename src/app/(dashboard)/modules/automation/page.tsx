"use client";

import { useApi } from "@/lib/hooks/use-api";
import { ModuleGuard } from "@/components/shared/module-guard";

export default function AutomationModulePage() {
  return <ModuleGuard moduleKey="automation"><AutomationContent /></ModuleGuard>;
}

function AutomationContent() {
  const { data: alerts } = useApi<any[]>("/api/alerts");
  const { data: recommendations } = useApi<any[]>("/api/recommendations");

  const alertCount = alerts?.length ?? 0;
  const recCount = recommendations?.length ?? 0;
  const criticalAlerts = alerts?.filter((a: any) => a.severity === "critical").length ?? 0;
  const highRecs = recommendations?.filter((r: any) => r.priority === "high").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Automation Module</h1>
        <p className="text-sm text-muted mt-1">Deterministic rules, automated alerts, and recommended actions</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Active Alerts</p>
          <p className="text-xl font-bold">{alertCount}</p>
          <p className="text-xs text-red-500 mt-1">{criticalAlerts} critical</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Recommendations</p>
          <p className="text-xl font-bold">{recCount}</p>
          <p className="text-xs text-amber-500 mt-1">{highRecs} high priority</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Alert Types</p>
          <p className="text-xl font-bold">15</p>
          <p className="text-xs text-muted mt-1">Monitored patterns</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Engine Type</p>
          <p className="text-xl font-bold">Heuristic</p>
          <p className="text-xs text-muted mt-1">Deterministic rules</p>
        </div>
      </div>

      {/* Alert Rules */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold mb-4">Active Alert Rules</h2>
        <div className="space-y-2">
          {[
            { name: "Stale Lead", trigger: "No activity > 5 days", severity: "warning" },
            { name: "Overdue Task", trigger: "Past due date", severity: "critical" },
            { name: "Stuck Deal", trigger: "Same stage > 14 days", severity: "warning" },
            { name: "At Risk Deal", trigger: "High value + no activity > 21d", severity: "critical" },
            { name: "No Next Step", trigger: "Open deal without scheduled task", severity: "warning" },
            { name: "High Value No Meeting", trigger: "Deal > R$50k without meeting", severity: "warning" },
            { name: "Pipeline Coverage Low", trigger: "Pipeline < 3x commit", severity: "warning" },
            { name: "Conversion Overdue", trigger: "HOT lead > 10 days unconverted", severity: "critical" },
            { name: "Meeting No Follow-up", trigger: "> 2 days post-meeting without task", severity: "warning" },
            { name: "Deal Aging", trigger: "Open > 30 days", severity: "info" },
            { name: "Inactive Account", trigger: "No activity > 30 days", severity: "info" },
            { name: "Integration Degraded", trigger: "Integration health < 50%", severity: "warning" },
            { name: "Token Expiring", trigger: "Token expires within 1h", severity: "warning" },
          ].map(rule => (
            <div key={rule.name} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-muted">{rule.trigger}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                rule.severity === "critical" ? "bg-red-100 text-red-700" :
                rule.severity === "warning" ? "bg-amber-100 text-amber-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {rule.severity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation Types */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold mb-4">Recommendation Engine</h2>
        <p className="text-sm text-muted mb-3">12 recommendation types generated from heuristic analysis of CRM data.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {["Follow Up", "Schedule Meeting", "Convert Lead", "Move Stage", "Apply Playbook", "Reassign Owner",
            "Create Task", "Escalate", "Send Email", "Update Forecast", "Review Deal", "Book Demo"].map(r => (
            <div key={r} className="rounded border border-border px-3 py-2 text-sm text-muted">{r}</div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Engine type: Deterministic heuristic.</strong> All alerts and recommendations are generated by rule-based analysis of CRM data.
          No generative AI is used for these outputs. Confidence scores reflect rule coverage, not ML prediction.
        </p>
      </div>
    </div>
  );
}
