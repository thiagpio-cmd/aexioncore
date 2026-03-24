"use client";

import { cn } from "@/lib/utils";

interface ReportSectionProps {
  section: {
    id: string;
    title: string;
    type: string;
    content: string;
    data?: Record<string, unknown>;
    source: string;
    confidence?: string;
  };
}

const SOURCE_COLORS: Record<string, string> = {
  AlertEngine: "bg-blue-100 text-blue-700",
  RecommendationEngine: "bg-emerald-100 text-emerald-700",
  prisma: "bg-gray-100 text-gray-600",
};

function SourceBadge({ source }: { source: string }) {
  const color = SOURCE_COLORS[source] || "bg-gray-100 text-gray-600";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", color)}>
      {source}
    </span>
  );
}

function ConfidenceIndicator({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    high: "text-emerald-600",
    medium: "text-amber-600",
    low: "text-red-600",
  };
  return (
    <span className={cn("text-[10px] font-medium uppercase tracking-wide", colors[confidence] || "text-muted")}>
      {confidence} confidence
    </span>
  );
}

function MetricsSection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted mb-0.5">{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</p>
          <p className="text-lg font-semibold text-foreground">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}

function FindingsSection({ content, data }: { content: string; data?: Record<string, unknown> }) {
  const rows = (data?.rows as Record<string, unknown>[]) || [];
  const columns = (data?.columns as string[]) || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
      {rows.length > 0 && columns.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2 text-left text-xs font-medium text-muted">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-background/30">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 text-sm text-foreground">{String(row[col] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BottlenecksSection({ content, data }: { content: string; data?: Record<string, unknown> }) {
  const items = (data?.items as Record<string, unknown>[]) || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{content}</p>
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-medium text-foreground">{String(item.title || item.name || `Bottleneck ${i + 1}`)}</p>
          {item.description ? <p className="text-xs text-muted mt-1">{String(item.description)}</p> : null}
          {item.entity ? <p className="text-xs text-amber-700 mt-1">Entity: {String(item.entity)}</p> : null}
        </div>
      ))}
    </div>
  );
}

function RisksSection({ content, data }: { content: string; data?: Record<string, unknown> }) {
  const items = (data?.items as Record<string, unknown>[]) || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{content}</p>
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-600 text-xs font-semibold uppercase">{String(item.severity || "risk")}</span>
          </div>
          <p className="text-sm font-medium text-foreground">{String(item.title || item.name || `Risk ${i + 1}`)}</p>
          {item.description ? <p className="text-xs text-muted mt-1">{String(item.description)}</p> : null}
        </div>
      ))}
    </div>
  );
}

function RecommendationsSection({ content, data }: { content: string; data?: Record<string, unknown> }) {
  const items = (data?.items as Record<string, unknown>[]) || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{content}</p>
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <p className="text-sm font-medium text-foreground">{String(item.title || item.name || `Recommendation ${i + 1}`)}</p>
          {item.description ? <p className="text-xs text-muted mt-1">{String(item.description)}</p> : null}
          {item.impact ? <p className="text-xs text-blue-700 mt-1">Impact: {String(item.impact)}</p> : null}
        </div>
      ))}
    </div>
  );
}

function TableSection({ data }: { data?: Record<string, unknown> }) {
  const rows = (data?.rows as Record<string, unknown>[]) || [];
  const columns = (data?.columns as string[]) || [];
  if (rows.length === 0 || columns.length === 0) return <p className="text-sm text-muted">No table data available</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-background/50">
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 text-left text-xs font-medium text-muted">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-background/30">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2 text-sm text-foreground">{String(row[col] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartDataSection({ data }: { data?: Record<string, unknown> }) {
  const items = (data?.items as { label: string; value: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted">No chart data available</p>;
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-32 text-sm text-foreground truncate">{item.label}</span>
          <div className="flex-1 h-6 rounded bg-background">
            <div
              className="h-6 rounded bg-primary flex items-center justify-end px-2"
              style={{ width: `${Math.max((item.value / maxValue) * 100, 5)}%` }}
            >
              <span className="text-[10px] font-medium text-white">{item.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportSection({ section }: ReportSectionProps) {
  const renderContent = () => {
    switch (section.type) {
      case "metrics":
        return section.data ? <MetricsSection data={section.data} /> : <p className="text-sm text-foreground">{section.content}</p>;
      case "findings":
        return <FindingsSection content={section.content} data={section.data} />;
      case "bottlenecks":
        return <BottlenecksSection content={section.content} data={section.data} />;
      case "risks":
        return <RisksSection content={section.content} data={section.data} />;
      case "recommendations":
        return <RecommendationsSection content={section.content} data={section.data} />;
      case "table":
        return <TableSection data={section.data} />;
      case "chart_data":
        return <ChartDataSection data={section.data} />;
      case "summary":
      default:
        return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{section.content}</p>;
    }
  };

  return (
    <div className="print:break-inside-avoid">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
        <SourceBadge source={section.source} />
        {section.confidence && <ConfidenceIndicator confidence={section.confidence} />}
      </div>
      {renderContent()}
    </div>
  );
}
