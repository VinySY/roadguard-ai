import React from 'react';
import { RoadIssue } from '../../types';
import { BarChart3, ShieldAlert, CheckCircle2, Clock, MapPin, Layers } from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { EmptyState } from '../common/EmptyState';

interface InspectorAnalyticsProps {
  issues: RoadIssue[];
}

const SEVERITY_ROWS = [
  { key: 'critical', label: 'Critical', text: 'text-rose-400', bar: 'bg-rose-500' },
  { key: 'high', label: 'High', text: 'text-amber-400', bar: 'bg-amber-500' },
  { key: 'medium', label: 'Medium', text: 'text-sky-400', bar: 'bg-sky-500' },
  { key: 'low', label: 'Low', text: 'text-emerald-400', bar: 'bg-emerald-500' },
] as const;

export const InspectorAnalytics: React.FC<InspectorAnalyticsProps> = ({ issues }) => {
  const total = issues.length;

  const severityCounts: Record<string, number> = {};
  SEVERITY_ROWS.forEach((row) => {
    severityCounts[row.key] = issues.filter((i) => i.severity === row.key).length;
  });

  const resolved = issues.filter((i) => i.status === 'resolved').length;
  const inspectionBacklog = issues.filter(
    (i) => i.status === 'reported' || i.status === 'notified_municipality'
  ).length;
  const openHighPriority = issues.filter(
    (i) => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved'
  ).length;

  // Zone concentration, derived from report locations and sorted by volume.
  const zoneCounts: Record<string, number> = {};
  issues.forEach((i) => {
    const area = i.location.area || i.location.city || 'Unspecified area';
    zoneCounts[area] = (zoneCounts[area] || 0) + 1;
  });
  const zones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
  const maxZoneCount = zones.length > 0 ? Math.max(...zones.map(([, count]) => count)) : 0;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow={
          <>
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            Pavement intelligence
          </>
        }
        icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
        title="Municipal pavement analytics"
        description="Severity distribution, resolution progress, and geographic defect concentration calculated directly from the current issue registry."
      />

      <section aria-label="Analytics summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Resolution rate"
          value={total > 0 ? `${Math.round((resolved / total) * 100)}%` : '—'}
          note={total > 0 ? `${resolved} of ${total} reports resolved` : 'No reports in the registry'}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Inspection backlog"
          value={inspectionBacklog}
          note="Reported or awaiting dispatch"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Open high priority"
          value={openHighPriority}
          note="Critical or high, unresolved"
          icon={ShieldAlert}
          tone="danger"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Severity distribution */}
        <section className="rg-panel space-y-4 rounded-xl p-5" aria-labelledby="severity-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="severity-heading" className="text-sm font-semibold text-slate-100">
              Severity distribution
            </h2>
            <span className="font-mono text-[11px] text-slate-500">{total} reports</span>
          </div>

          {total === 0 ? (
            <EmptyState icon={Layers} title="No severity data yet" description="Severity bars populate as reports enter the registry." />
          ) : (
            <div className="space-y-3 text-xs">
              {SEVERITY_ROWS.map((row) => {
                const count = severityCounts[row.key] ?? 0;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={row.key}>
                    <div className="mb-1 flex justify-between">
                      <span className={`font-medium ${row.text}`}>{row.label}</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full ${row.bar}`}
                        style={{ width: `${pct}%` }}
                        role="presentation"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Geographic concentration */}
        <section className="rg-panel space-y-4 rounded-xl p-5" aria-labelledby="zone-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="zone-heading" className="text-sm font-semibold text-slate-100">
              Geographic defect concentration
            </h2>
            <span className="font-mono text-[11px] text-slate-500">{zones.length} areas</span>
          </div>

          {zones.length === 0 ? (
            <EmptyState icon={MapPin} title="No location data yet" description="Area concentration appears once reports include a location." />
          ) : (
            <div className="space-y-2.5">
              {zones.map(([zone, count]) => (
                <div
                  key={zone}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                    <span className="truncate font-medium text-slate-200">{zone}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono tabular-nums text-slate-400">
                      {count} incident{count === 1 ? '' : 's'}
                    </span>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${maxZoneCount > 0 ? (count / maxZoneCount) * 100 : 0}%` }}
                        role="presentation"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
