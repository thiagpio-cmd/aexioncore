"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";

const categoryColors: Record<string, string> = {
  Outbound: "bg-blue-100 text-blue-700",
  Qualification: "bg-green-100 text-green-700",
  Discovery: "bg-purple-100 text-purple-700",
  Objections: "bg-red-100 text-red-700",
  "Follow-up": "bg-orange-100 text-orange-700",
  Relationship: "bg-teal-100 text-teal-700",
  Recovery: "bg-gray-100 text-gray-700",
};

export default function PlaybooksPage() {
  const { data, loading } = useApi<any[]>("/api/playbooks");
  const items = data || [];
  const [category, setCategory] = useState("all");

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Playbooks" subtitle="Loading..." />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Playbooks" subtitle="No playbooks available" />
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-sm">No playbooks found.</p>
        </div>
      </div>
    );
  }

  const categories = [...new Set(items.map((p) => p.segment).filter(Boolean))];
  const filtered = category === "all" ? items : items.filter((p) => p.segment === category);

  return (
    <div className="space-y-4">
      <PageHeader title="Playbooks" subtitle={`${items.length} playbooks available`} />
      <div className="flex gap-2">
        <button onClick={() => setCategory("all")} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${category === "all" ? "bg-primary text-white" : "bg-surface border border-border text-muted"}`}>All</button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${category === c ? "bg-primary text-white" : "bg-surface border border-border text-muted"}`}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((pb) => (
          <div key={pb.id} className="rounded-xl border border-border bg-surface p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColors[pb.segment] || "bg-gray-100 text-gray-600"}`}>{pb.segment || "General"}</span>
              <span className="text-xs text-muted">{pb.stage}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{pb.name}</h3>
            <p className="text-xs text-muted leading-relaxed mb-3">{pb.description}</p>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-xs text-muted">{pb.steps?.length || 0} steps</span>
              <span className="text-xs text-muted">Stage: {pb.stage}</span>
              <span className="text-xs text-success font-medium">{pb.conversionRate}% avg. conversion</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">Used {pb.usage || 0} times</span>
              <Link href={`/playbooks/${pb.id}`} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors">Open Playbook</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
