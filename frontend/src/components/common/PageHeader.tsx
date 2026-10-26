import React from 'react';

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page-level heading used across every workspace view.
 * Keeps breadcrumbs/eyebrows, title, description and actions aligned.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  icon,
  className = '',
}) => {
  return (
    <header
      className={`flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between ${className}`}
      style={{ borderColor: 'var(--rg-border-soft)' }}
    >
      <div className="min-w-0">
        {eyebrow && <div className="rg-kicker mb-2">{eyebrow}</div>}
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="rg-page-title">{title}</h1>
            {description && <p className="rg-page-subtitle">{description}</p>}
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
};
