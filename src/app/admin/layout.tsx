"use client";

import { AdminGate } from "@/components/admin/admin-gate";
import { ToastProvider } from "@/components/shared/toast";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AdminGate>
        <div className="min-h-screen bg-[#0a0a1a]">
          {/* Admin Header */}
          <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a1a]/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2457FF]">
                  <span className="text-xs font-bold text-white">A</span>
                </div>
                <span className="text-sm font-bold text-white">Aexion Admin</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  INTERNAL
                </span>
              </div>
              <nav className="flex items-center gap-4">
                <a href="/admin" className="text-sm text-white/60 hover:text-white transition-colors">
                  Dashboard
                </a>
                <a href="/admin/tenants" className="text-sm text-white/60 hover:text-white transition-colors">
                  Tenants
                </a>
                <a href="/admin/plans" className="text-sm text-white/60 hover:text-white transition-colors">
                  Plans
                </a>
                <a href="/admin/licenses" className="text-sm text-white/60 hover:text-white transition-colors">
                  Licenses
                </a>
                <a href="/admin/billing" className="text-sm text-white/60 hover:text-white transition-colors">
                  Billing
                </a>
                <a href="/admin/analytics" className="text-sm text-white/60 hover:text-white transition-colors">
                  Analytics
                </a>
                <a href="/admin/audit" className="text-sm text-white/60 hover:text-white transition-colors">
                  Audit
                </a>
                <a href="/admin/provision" className="text-sm text-white/60 hover:text-white transition-colors">
                  Provision
                </a>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("admin_secret");
                      window.location.href = "/admin/tenants";
                    }
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
                >
                  Lock
                </button>
              </nav>
            </div>
          </header>

          {/* Content */}
          <main className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </main>
        </div>
      </AdminGate>
    </ToastProvider>
  );
}
