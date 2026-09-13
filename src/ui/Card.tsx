import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function Card({ title, description, actions, className = '', children, ...props }: CardProps) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`} {...props}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-1 text-sm text-sub">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
