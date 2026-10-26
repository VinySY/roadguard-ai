import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'amber' | 'success' | 'danger' | 'info';
  className?: string;
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-slate-100',
  amber: 'text-amber-400',
  success: 'text-emerald-400',
  danger: 'text-rose-400',
  info: 'text-sky-400',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  note,
  icon: Icon,
  tone = 'default',
  className = '',
}) => {
  return (
    <div className={`rg-kpi ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="rg-kpi-label">{label}</span>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <span className={`rg-kpi-value ${TONE_CLASS[tone]}`}>{value}</span>
      {note && <span className="rg-kpi-note">{note}</span>}
    </div>
  );
};
