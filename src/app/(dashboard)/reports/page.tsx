"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApi, apiPost, apiDelete } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/shared/skeleton";
import { Modal, FormField, inputStyles, selectStyles } from "@/components/shared/modal";
import { ReportSection } from "@/components/reports/report-section";
import { ExportDropdown } from "@/components/reports/export-dropdown";
import { cn, formatDate } from "@/lib/utils";

type Tab = "generator" | "saved";
type Period = "7d" | "30d" | "90d" | "365d" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "365d", label: "1 year" },
  { key: "custom", label: "Custom" },
];

const MODULES = [
  "Pipeline",
  "Leads",
  "Activities",
  "Team",
  "Forecast",
  "Alerts",
  "Recommendations",
] as const;

const SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "LINKEDIN",
  "COLD_CALL",
  "INBOUND",
  "EVENT",
  "PARTNER",
  "OTHER",
];

const STAGES = [
  "DISCOVERY",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

interface ReportData {
  id: string;
  title: string;
  type: string;
  period: string;
  executiveSynthesis: {
    summary: string;
    methodology: string;
    keyFindings: string[];
    criticalRisks: string[];
    topRecommendations: string[];
  };
  sections: {
    id: string;
    title: string;
    type: string;
    content: string;
    data?: Record<string, unknown>;
    source: string;
    confidence?: string;
  }[];
  metadata: {
    dataPointsAnalyzed: number;
    alertsChecked: number;
    recommendationsGenerated: number;
    synthesisMethod: string;
  };
  createdAt: string;
}

interface SavedReport {
  id: string;
  title: string;
  type: string;
  period: string;
  createdAt: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const [tab, setTab] = useState<Tab>("generator");

  // Generator state
  const [period, setPeriod] = useState<Period>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([...MODULES]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [repFilter, setRepFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<ReportData | null>(null);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  // Saved reports
  const { data: savedReports, loading: loadingSaved, refetch: refetchSaved } = useApi<SavedReport[]>(
    tab === "saved" ? "/api/reports" : null
  );
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users");

  const toggleModule = (mod: string) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleGenerate = useCallback(async () => {
    if (selectedModules.length === 0) {
      toastError("Select at least one module");
      return;
    }
    if (period === "custom" && (!customStart || !customEnd)) {
      toastError("Select start and end dates for custom period");
      return;
    }

    setGenerating(true);
    setGeneratedReport(null);

    const body: Record<string, unknown> = {
      period,
      modules: selectedModules.map((m) => m.toLowerCase()),
    };
    if (period === "custom") {
      body.startDate = customStart;
      body.endDate = customEnd;
    }
    if (repFilter) body.repId = repFilter;
    if (stageFilter) body.stage = stageFilter;
    if (sourceFilter) body.source = sourceFilter;

    const { data, error } = await apiPost<ReportData>("/api/reports/generate", body);
    setGenerating(false);

    if (error) {
      toastError(error);
      return;
    }
    if (data) {
      setGeneratedReport(data);
      toastSuccess("Report generated successfully");
    }
  }, [period, customStart, customEnd, selectedModules, repFilter, stageFilter, sourceFilter, toastSuccess, toastError]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) {
      toastError("Enter a report name");
      return;
    }
    if (!generatedReport) return;

    setSaving(true);
    const { error } = await apiPost("/api/reports", {
      ...generatedReport,
      title: saveName.trim(),
    });
    setSaving(false);

    if (error) {
      toastError(error);
      return;
    }
    toastSuccess("Report saved");
    setShowSaveModal(false);
    setSaveName("");
  }, [saveName, generatedReport, toastSuccess, toastError]);

  const handleArchive = useCallback(
    async (id: string) => {
      const { success, error } = await apiDelete(`/api/reports/${id}`);
      if (!success) {
        toastError(error || "Failed to archive report");
        return;
      }
      toastSuccess("Report archived");
      refetchSaved();
    },
    [toastSuccess, toastError, refetchSaved]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Generate, view, and manage reports"
        actions={
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
            {(["generator", "saved"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                  tab === t
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                )}
              >
                {t === "generator" ? "Generator" : "Saved Reports"}
              </button>
            ))}
          </div>
        }
      />

      {/* ─── Generator Tab ─────────────────────────────────────────────── */}
      {tab === "generator" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
            {/* Period Selector */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Period</label>
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5 w-fit">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      period === p.key
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {period === "custom" && (
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={inputStyles}
                    style={{ maxWidth: 200 }}
                  />
                  <span className="text-sm text-muted">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className={inputStyles}
                    style={{ maxWidth: 200 }}
                  />
                </div>
              )}
            </div>

            {/* Module Checkboxes */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Modules</label>
              <div className="flex flex-wrap gap-3">
                {MODULES.map((mod) => (
                  <label
                    key={mod}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                      selectedModules.includes(mod)
                        ? "border-primary bg-primary-light text-primary"
                        : "border-border bg-background text-muted hover:text-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(mod)}
                      onChange={() => toggleModule(mod)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                        selectedModules.includes(mod)
                          ? "border-primary bg-primary"
                          : "border-border bg-background"
                      )}
                    >
                      {selectedModules.includes(mod) && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    {mod}
                  </label>
                ))}
              </div>
            </div>

            {/* Advanced Filters */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className={cn("transition-transform", showAdvanced && "rotate-90")}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                Advanced Filters
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Rep</label>
                    <select
                      value={repFilter}
                      onChange={(e) => setRepFilter(e.target.value)}
                      className={selectStyles}
                    >
                      <option value="">All Reps</option>
                      {(users || []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Stage</label>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className={selectStyles}
                    >
                      <option value="">All Stages</option>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Source</label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className={selectStyles}
                    >
                      <option value="">All Sources</option>
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating Report...
                </span>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>

          {/* Loading State */}
          {generating && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm font-medium text-foreground">Generating your report...</p>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div className="h-2 rounded-full bg-primary animate-pulse" style={{ width: "60%" }} />
                </div>
                <p className="text-xs text-muted mt-2">Analyzing data across {selectedModules.length} modules</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </div>
          )}

          {/* Generated Report */}
          {generatedReport && !generating && (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Generated Report</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                  >
                    Save Report
                  </button>
                  <ExportDropdown reportId={generatedReport.id} />
                </div>
              </div>

              {/* Executive Synthesis */}
              <div className="rounded-xl border border-border bg-primary/5 p-6 print:break-inside-avoid">
                <h2 className="text-xl font-bold text-foreground mb-1">Executive Synthesis</h2>
                {generatedReport.executiveSynthesis?.methodology && (
                  <p className="text-xs italic text-muted mb-4">
                    Methodology: {generatedReport.executiveSynthesis.methodology}
                  </p>
                )}
                <p className="text-sm text-foreground leading-relaxed mb-5">
                  {generatedReport.executiveSynthesis?.summary}
                </p>

                {(generatedReport.executiveSynthesis?.keyFindings?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Key Findings</h4>
                    <ul className="space-y-1.5">
                      {generatedReport.executiveSynthesis.keyFindings.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(generatedReport.executiveSynthesis?.criticalRisks?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-red-600 mb-2">Critical Risks</h4>
                    <ul className="space-y-1.5">
                      {generatedReport.executiveSynthesis.criticalRisks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(generatedReport.executiveSynthesis?.topRecommendations?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-primary mb-2">Top Recommendations</h4>
                    <ul className="space-y-1.5">
                      {generatedReport.executiveSynthesis.topRecommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-primary">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Report Sections */}
              <div className="space-y-8">
                {generatedReport.sections?.map((section) => (
                  <div key={section.id} className="rounded-xl border border-border bg-surface p-6">
                    <ReportSection section={section} />
                  </div>
                ))}
              </div>

              {/* Footer Metadata */}
              {generatedReport.metadata && (
                <div className="rounded-xl border border-border bg-background p-4 flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center gap-4">
                    <span>{generatedReport.metadata.dataPointsAnalyzed} data points analyzed</span>
                    <span>{generatedReport.metadata.alertsChecked} alerts checked</span>
                    <span>{generatedReport.metadata.recommendationsGenerated} recommendations generated</span>
                  </div>
                  <span>Synthesis: {generatedReport.metadata.synthesisMethod}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Saved Reports Tab ─────────────────────────────────────────── */}
      {tab === "saved" && (
        <div>
          {loadingSaved ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !savedReports || savedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted rounded-xl border border-border bg-surface">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="mb-3 text-muted/50">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium">No saved reports</p>
              <p className="text-xs mt-1">Generate a report and save it to see it here</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted">Title</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted">Period</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted">Generated At</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {savedReports.map((report) => (
                    <tr key={report.id} className="hover:bg-background/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-foreground">{report.title}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                          {report.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted">{report.period}</td>
                      <td className="px-5 py-3 text-sm text-muted">{formatDate(report.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/reports/${report.id}`)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-light transition-colors"
                          >
                            View
                          </button>
                          <ExportDropdown reportId={report.id} />
                          <button
                            onClick={() => handleArchive(report.id)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-danger hover:bg-red-50 transition-colors"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      <Modal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Report"
        description="Give this report a name so you can find it later."
      >
        <div className="space-y-4">
          <FormField label="Report Name" required>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g., Q1 Pipeline Review"
              className={inputStyles}
              autoFocus
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSaveModal(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
