import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-sub">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
