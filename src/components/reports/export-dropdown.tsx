"use client";

import { useState, useRef, useEffect } from "react";

interface ExportDropdownProps {
  reportId: string;
  onExport?: (format: string) => void;
}

export function ExportDropdown({ reportId, onExport }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleExport = (format: string) => {
    setOpen(false);
    if (onExport) {
      onExport(format);
      return;
    }
    const link = document.createElement("a");
    link.href = `/api/reports/${reportId}/export?format=${format}`;
    link.download = `report-${reportId}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background transition-colors flex items-center gap-1.5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-surface shadow-lg py-1 min-w-[140px]">
          <button
            onClick={() => handleExport("csv")}
            className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-background transition-colors"
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-background transition-colors"
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
