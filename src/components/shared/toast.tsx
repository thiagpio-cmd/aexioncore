"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    toastSuccess: useCallback((msg: string) => addToast("success", msg), [addToast]),
    toastError: useCallback((msg: string) => addToast("error", msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-up flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm font-medium transition-all ${
              t.type === "success"
                ? "bg-emerald-600 text-white"
                : t.type === "error"
                ? "bg-red-600 text-white"
                : t.type === "warning"
                ? "bg-amber-500 text-white"
                : "bg-[#1e293b] text-white"
            }`}
          >
            {t.type === "success" && (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 10l3.5 3.5L15 7" />
              </svg>
            )}
            {t.type === "error" && (
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 7v4M10 13h.01" />
              </svg>
            )}
            {t.message}
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
