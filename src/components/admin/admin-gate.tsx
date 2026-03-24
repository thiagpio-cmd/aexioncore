"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AdminContextValue {
  secret: string;
  headers: Record<string, string>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminSecret(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminSecret must be used within AdminGate");
  return ctx;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [secret, setSecret] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_secret") || "";
    }
    return "";
  });
  const [verified, setVerified] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verify = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/tenants", {
        headers: { Authorization: `Bearer ${input.trim()}` },
      });

      if (res.ok) {
        sessionStorage.setItem("admin_secret", input.trim());
        setSecret(input.trim());
        setVerified(true);
      } else {
        setError("Invalid admin secret");
      }
    } catch {
      setError("Connection failed");
    }
    setLoading(false);
  }, [input]);

  // Auto-verify if secret exists in sessionStorage
  if (secret && !verified) {
    fetch("/api/admin/tenants", {
      headers: { Authorization: `Bearer ${secret}` },
    })
      .then((res) => {
        if (res.ok) setVerified(true);
        else {
          sessionStorage.removeItem("admin_secret");
          setSecret("");
        }
      })
      .catch(() => {
        sessionStorage.removeItem("admin_secret");
        setSecret("");
      });
  }

  if (verified && secret) {
    return (
      <AdminContext.Provider value={{ secret, headers: { Authorization: `Bearer ${secret}` } }}>
        {children}
      </AdminContext.Provider>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a1a]">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2457FF]/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2457FF" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Aexion Admin</h1>
          <p className="mt-1 text-sm text-white/50">Enter admin secret to continue</p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
            placeholder="Admin secret"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#2457FF] focus:outline-none"
            autoFocus
          />

          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={verify}
            disabled={loading || !input.trim()}
            className="w-full rounded-lg bg-[#2457FF] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a45dd] disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Access Admin Panel"}
          </button>
        </div>
      </div>
    </div>
  );
}
