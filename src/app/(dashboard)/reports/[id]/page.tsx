"use client";

import { useParams, useRouter } from "next/navigation";
import { useApi, apiDelete } from "@/lib/hooks/use-api";
import { useToast } from "@/components/shared/toast";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeleton";
import { ReportSection } from "@/components/reports/report-section";
import { ExportDropdown } from "@/components/reports/export-dropdown";
import { formatDate } from "@/lib/utils";

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

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const id = params.id as string;

  const { data: report, loading } = useApi<ReportData>(`/api/reports/${id}`);

  const handleArchive = async () => {
    const { success, error } = await apiDelete(`/api/reports/${id}`);
    if (!success) {
      toastError(error || "Failed to archive report");
      return;
    }
    toastSuccess("Report archived");
    router.push("/reports");
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report" subtitle="Loading..." />
        <DetailSkeleton />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report" subtitle="Not found" />
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">Report not found or has been archived.</p>
          <button
            onClick={() => router.push("/reports")}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto print:max-w-none">
      {/* Header */}
      <div className="print:hidden">
        <PageHeader
          title={report.title}
          subtitle={`${report.period} — Generated ${formatDate(report.createdAt)}`}
          actions={
            <div className="flex items-center gap-2">
              <ExportDropdown reportId={report.id} />
              <button
                onClick={handlePrint}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background transition-colors flex items-center gap-1.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>
              <button
                onClick={handleArchive}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-danger hover:bg-red-50 transition-colors"
              >
                Archive
              </button>
            </div>
          }
        />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-foreground">{report.title}</h1>
        <p className="text-sm text-muted mt-1">{report.period} — Generated {formatDate(report.createdAt)}</p>
      </div>

      {/* Methodology Notice */}
      {report.executiveSynthesis?.methodology && (
        <p className="text-xs italic text-muted">
          Methodology: {report.executiveSynthesis.methodology}
        </p>
      )}

      {/* Executive Synthesis */}
      <div className="rounded-xl border border-border bg-primary/5 p-8 print:border-0 print:bg-transparent print:p-0 print:break-inside-avoid">
        <h2 className="text-xl font-bold text-foreground mb-4">Executive Synthesis</h2>
        <p className="text-sm text-foreground leading-relaxed mb-6">
          {report.executiveSynthesis?.summary}
        </p>

        {(report.executiveSynthesis?.keyFindings?.length ?? 0) > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-foreground mb-2">Key Findings</h4>
            <ul className="space-y-2">
              {report.executiveSynthesis.keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(report.executiveSynthesis?.criticalRisks?.length ?? 0) > 0 && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50/50 p-4 print:border print:bg-transparent">
            <h4 className="text-sm font-semibold text-red-600 mb-2">Critical Risks</h4>
            <ul className="space-y-2">
              {report.executiveSynthesis.criticalRisks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-red-700 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(report.executiveSynthesis?.topRecommendations?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 print:border print:bg-transparent">
            <h4 className="text-sm font-semibold text-primary mb-2">Top Recommendations</h4>
            <ul className="space-y-2">
              {report.executiveSynthesis.topRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-primary leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Report Sections */}
      <div className="space-y-8">
        {report.sections?.map((section) => (
          <div
            key={section.id}
            className="rounded-xl border border-border bg-surface p-6 print:border-0 print:bg-transparent print:p-0 print:break-inside-avoid print:mb-8"
          >
            <ReportSection section={section} />
          </div>
        ))}
      </div>

      {/* Footer Metadata */}
      {report.metadata && (
        <div className="rounded-xl border border-border bg-background p-5 print:border-t print:border-b-0 print:border-x-0 print:rounded-none print:bg-transparent">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
            <div className="flex items-center gap-6">
              <div>
                <span className="font-medium text-foreground">{report.metadata.dataPointsAnalyzed}</span>{" "}
                data points analyzed
              </div>
              <div>
                <span className="font-medium text-foreground">{report.metadata.alertsChecked}</span>{" "}
                alerts checked
              </div>
              <div>
                <span className="font-medium text-foreground">{report.metadata.recommendationsGenerated}</span>{" "}
                recommendations generated
              </div>
            </div>
            <div>
              Synthesis method: <span className="font-medium text-foreground">{report.metadata.synthesisMethod}</span>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="print:hidden">
        <button
          onClick={() => router.push("/reports")}
          className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Reports
        </button>
      </div>
    </div>
  );
}
