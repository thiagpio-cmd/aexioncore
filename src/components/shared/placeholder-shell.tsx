import React from "react";

export function PlaceholderShell({ title, module }: { title: string; module: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover border border-border">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted">
        This area is part of the new <strong>{module}</strong> architecture. It is currently a placeholder shell to demonstrate the future module-driven navigation structure.
      </p>
    </div>
  );
}
