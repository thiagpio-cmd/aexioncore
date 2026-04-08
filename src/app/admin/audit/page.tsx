"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

interface AuditEntry {
  id: string;
  adminIdentifier: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_PLAN: "text-[#10B981]",
  UPDATE_PLAN: "text-blue-400",
  DELETE_PLAN: "text-red-400",
  CREATE_SUBSCRIPTION: "text-[#10B981]",
  UPDATE_SUBSCRIPTION: "text-blue-400",
  CANCEL_SUBSCRIPTION: "text-red-400",
  PROVISION_TENANT: "text-[#10B981]",
  TOGGLE_TENANT: "text-amber-400",
  RESET_PASSWORD: "text-amber-400",
  UPDATE_USER: "text-blue-400",
  GENERATE_LICENSE: "text-purple-400",
  REVOKE_LICENSE: "text-red-400",
  ACTIVATE_LICENSE: "text-[#10B981]",
  CREATE_INVOICE: "text-[#10B981]",
  VOID_INVOICE: "text-red-400",
};

export default function AuditPage() {
  const { headers } = useAdminSecret();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/audit?page=${page}&limit=30`;
      if (actionFilter) url += `&action=${actionFilter}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Audit fetch error:", err);
    }
    setLoading(false);
  }, [headers, page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-white/40 mt-0.5">{total} event{total !== 1 ? "s" : ""} recorded</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "CREATE_PLAN", "CREATE_SUBSCRIPTION", "CANCEL_SUBSCRIPTION", "PROVISION_TENANT", "TOGGLE_TENANT", "GENERATE_LICENSE", "REVOKE_LICENSE", "UPDATE_USER"].map((a) => (
          <button
            key={a}
            onClick={() => { setActionFilter(a); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
              actionFilter === a
                ? "bg-[#2457FF] text-white"
                : "border border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {a || "All"}
          </button>
        ))}
      </div>

      {/* Logs */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <p className="text-sm text-white/40">No audit events found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/5">
          {logs.map((log) => {
            const details = log.details ? (() => { try { return JSON.parse(log.details); } catch { return null; } })() : null;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="hover:bg-white/2 transition-colors">
                <div
                  className="flex items-center justify-between px-5 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <div>
                      <span className={`text-xs font-semibold ${ACTION_COLORS[log.action] || "text-white/60"}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-white/20 ml-2">on {log.targetType}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-white/20">{log.adminIdentifier}</span>
                    <span className="text-[10px] text-white/10">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-white/20 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {isExpanded && details && (
                  <div className="px-5 pb-3 pl-10">
                    <pre className="text-[11px] text-white/30 bg-black/20 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                    {log.targetId && (
                      <p className="text-[10px] text-white/15 mt-1">Target ID: {log.targetId}</p>
                    )}
                    {log.ipAddress && (
                      <p className="text-[10px] text-white/15">IP: {log.ipAddress}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:text-white disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs text-white/30">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:text-white disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
