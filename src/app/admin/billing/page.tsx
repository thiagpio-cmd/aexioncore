"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSecret } from "@/components/admin/admin-gate";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  subscription: { id: string; plan: { name: string; tier: string } } | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/40",
  OPEN: "bg-amber-500/20 text-amber-400",
  PAID: "bg-[#10B981]/20 text-[#10B981]",
  VOID: "bg-red-500/20 text-red-400",
  UNCOLLECTIBLE: "bg-red-500/20 text-red-400",
};

export default function BillingPage() {
  const { headers } = useAdminSecret();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    organizationId: "",
    amountDue: 0,
    notes: "",
  });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "all"
        ? "/api/admin/invoices"
        : `/api/admin/invoices?status=${filter}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.success) setInvoices(data.data);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    }
    setLoading(false);
  }, [headers, filter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const fmtCurrency = (cents: number, curr: string = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(cents / 100);

  const totalDue = invoices
    .filter((inv) => inv.status === "OPEN")
    .reduce((sum, inv) => sum + inv.amountDue, 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.amountPaid, 0);

  const createInvoice = async () => {
    try {
      await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      setShowCreate(false);
      setCreateForm({ organizationId: "", amountDue: 0, notes: "" });
      await fetchInvoices();
    } catch (err) {
      console.error("Create invoice failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-sm text-white/40 mt-0.5">Invoice management &amp; revenue tracking</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a45dd] transition-colors"
        >
          + Create Invoice
        </button>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] text-white/30 uppercase">Total Invoices</p>
          <p className="text-xl font-bold text-white">{invoices.length}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[10px] text-amber-400/60 uppercase">Outstanding</p>
          <p className="text-xl font-bold text-amber-400">{fmtCurrency(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-[#10B981]/20 bg-[#10B981]/5 p-4">
          <p className="text-[10px] text-[#10B981]/60 uppercase">Collected</p>
          <p className="text-xl font-bold text-[#10B981]">{fmtCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] text-white/30 uppercase">Open Invoices</p>
          <p className="text-xl font-bold text-white">
            {invoices.filter((inv) => inv.status === "OPEN").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "OPEN", "PAID", "DRAFT", "VOID"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-[#2457FF] text-white"
                : "border border-white/10 text-white/40 hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl border border-white/5 bg-white/2 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
          <p className="text-sm text-white/40">No invoices found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Invoice</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Tenant</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Plan</th>
                <th className="px-5 py-3 text-right text-[10px] text-white/30 uppercase">Amount</th>
                <th className="px-5 py-3 text-center text-[10px] text-white/30 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-[10px] text-white/30 uppercase">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <code className="text-xs text-white font-mono">{inv.invoiceNumber}</code>
                  </td>
                  <td className="px-5 py-3 text-sm text-white/60">{inv.organization.name}</td>
                  <td className="px-5 py-3 text-xs text-white/40">
                    {inv.subscription?.plan?.name || "—"}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-white">
                    {fmtCurrency(inv.amountDue, inv.currency)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a2e] p-6">
            <h3 className="text-lg font-bold text-white mb-4">Create Invoice</h3>
            <div className="space-y-3">
              <input
                type="text" placeholder="Organization ID"
                value={createForm.organizationId}
                onChange={(e) => setCreateForm({ ...createForm, organizationId: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none"
              />
              <div>
                <label className="text-[10px] text-white/30 mb-0.5 block">Amount (cents)</label>
                <input
                  type="number" value={createForm.amountDue}
                  onChange={(e) => setCreateForm({ ...createForm, amountDue: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#2457FF] focus:outline-none"
                />
              </div>
              <textarea
                placeholder="Notes (optional)" value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60"
              >
                Cancel
              </button>
              <button
                onClick={createInvoice}
                disabled={!createForm.organizationId || !createForm.amountDue}
                className="flex-1 rounded-lg bg-[#2457FF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
