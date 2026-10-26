import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, Clock3, Info, ShieldAlert } from 'lucide-react';
import { IssueStatus, SeverityLevel } from '../../types';

type Tone = 'amber' | 'success' | 'danger' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  amber: 'rg-badge-amber',
  success: 'rg-badge-success',
  danger: 'rg-badge-danger',
  info: 'rg-badge-info',
  neutral: 'rg-badge-neutral',
};

const SEVERITY_TONE: Record<string, Tone> = {
  critical: 'danger',
  high: 'amber',
  medium: 'info',
  low: 'neutral',
  minor: 'neutral',
  moderate: 'info',
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <ShieldAlert className="h-3 w-3" aria-hidden="true" />,
  high: <AlertTriangle className="h-3 w-3" aria-hidden="true" />,
  medium: <CircleDot className="h-3 w-3" aria-hidden="true" />,
  low: <Info className="h-3 w-3" aria-hidden="true" />,
};

const STATUS_TONE: Record<IssueStatus, Tone> = {
  reported: 'neutral',
  notified_municipality: 'amber',
  inspection_scheduled: 'info',
  in_repair: 'amber',
  resolved: 'success',
};

const STATUS_LABEL: Record<IssueStatus, string> = {
  reported: 'Reported',
  notified_municipality: 'Municipality notified',
  inspection_scheduled: 'Inspection scheduled',
  in_repair: 'Repair underway',
  resolved: 'Resolved',
};

const STATUS_ICON: Partial<Record<IssueStatus, React.ReactNode>> = {
  reported: <CircleDot className="h-3 w-3" aria-hidden="true" />,
  notified_municipality: <Clock3 className="h-3 w-3" aria-hidden="true" />,
  resolved: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
  in_repair: <AlertTriangle className="h-3 w-3" aria-hidden="true" />,
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, icon, className = '', title }) => (
  <span className={`rg-badge ${TONE_CLASS[tone]} ${className}`} title={title}>
    {icon}
    {children}
  </span>
);

export const SeverityBadge: React.FC<{ severity: SeverityLevel | string; className?: string }> = ({
  severity,
  className,
}) => {
  const key = String(severity).toLowerCase();
  return (
    <Badge
      tone={SEVERITY_TONE[key] || 'neutral'}
      icon={SEVERITY_ICON[key] || <CircleDot className="h-3 w-3" aria-hidden="true" />}
      className={`capitalize ${className}`}
    >
      {severity}
    </Badge>
  );
};

export const StatusBadge: React.FC<{ status: IssueStatus; className?: string }> = ({ status, className }) => (
  <Badge tone={STATUS_TONE[status] || 'neutral'} icon={STATUS_ICON[status]} className={className}>
    {STATUS_LABEL[status] || String(status).replace(/_/g, ' ')}
  </Badge>
);

export const statusLabel = (status: IssueStatus) => STATUS_LABEL[status] || String(status).replace(/_/g, ' ');
