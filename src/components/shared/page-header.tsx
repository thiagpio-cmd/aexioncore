"use client";

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, subtitle, actions }: PageHeaderProps) {
  const text = description || subtitle;
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
        {text && (
          <p className="mt-0.5 text-sm text-muted/70">{text}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
