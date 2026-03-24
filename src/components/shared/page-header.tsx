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
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {text && (
          <p className="mt-1 text-sm text-muted">{text}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
