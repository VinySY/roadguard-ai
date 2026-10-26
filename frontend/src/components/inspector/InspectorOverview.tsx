import React from 'react';
import { RoadIssue, LocationCoordinates, User } from '../../types';
import { LeafletMap } from '../map/LeafletMap';
import {
  AlertOctagon,
  Clock,
  CheckCircle2,
  Wrench,
  ArrowRight,
  UserCheck,
  Building2,
  MapPin,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { SeverityBadge, StatusBadge, statusLabel } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';

interface InspectorOverviewProps {
  currentUser: User;
  issues: RoadIssue[];
  userLocation: LocationCoordinates | null;
  onOpenIssue: (issue: RoadIssue) => void;
  onNavigateToMap: () => void;
  onNavigateToAssignments: () => void;
  onNavigateToReports: () => void;
  onLocationUpdate?: (coords: LocationCoordinates) => void;
}

export const InspectorOverview: React.FC<InspectorOverviewProps> = ({
  currentUser,
  issues,
  userLocation,
  onOpenIssue,
  onNavigateToMap,
  onNavigateToAssignments,
  onNavigateToReports,
  onLocationUpdate,
}) => {
  const totalReports = issues.length;
  const awaitingInspection = issues.filter(
    (i) => i.status === 'reported' || i.status === 'notified_municipality'
  ).length;
  const underRepair = issues.filter(
    (i) => i.status === 'inspection_scheduled' || i.status === 'in_repair'
  ).length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length;

  const criticalIssues = issues.filter(
    (i) => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved'
  );

  const unassignedCount = issues.filter((i) => !i.assignedWorkerId && i.status !== 'resolved').length;

  // Recent municipal activity, derived from real issue timelines.
  const recentTimeline = issues
    .flatMap((issue) =>
      issue.timeline.map((event) => ({
        ...event,
        issueRef: issue.referenceNumber,
        issue,
      }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Municipal engineering &amp; quality control
          </>
        }
        icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        title={`Pavement operations — ${currentUser.name}`}
        description={
          <>
            Jurisdiction:{' '}
            <span className="font-medium text-amber-400">{currentUser.assignedZone || 'All sectors'}</span>
            . Live municipal workload, crew dispatch, and incident triage.
          </>
        }
        actions={
          <>
            <button type="button" onClick={onNavigateToAssignments} className="rg-btn rg-btn-secondary">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Crew assignments ({unassignedCount})
            </button>
            <button type="button" onClick={onNavigateToReports} className="rg-btn rg-btn-primary">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Executive reports
            </button>
          </>
        }
      />

      {/* Municipal workload — all values derived from live issue data */}
      <section aria-label="Municipal workload" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total road reports" value={totalReports} note="Across all zones" icon={ClipboardList} />
        <StatCard
          label="Awaiting inspection"
          value={awaitingInspection}
          note="Pending site visit"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Under active repair"
          value={underRepair}
          note="Crews dispatched"
          icon={Wrench}
          tone="info"
        />
        <StatCard
          label="Resolved"
          value={resolvedCount}
          note={
            totalReports > 0
              ? `${Math.round((resolvedCount / totalReports) * 100)}% of all reports`
              : 'No reports yet'
          }
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      {/* Situation map */}
      <section className="space-y-2.5" aria-labelledby="situation-map-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="situation-map-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            Municipal road situation map
            <span className="text-xs font-normal text-slate-500">Incident density &amp; status</span>
          </h2>
          <button
            type="button"
            onClick={onNavigateToMap}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
          >
            Open full map console
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-700/60 shadow-lg">
          <LeafletMap
            issues={issues}
            role="inspector"
            userLocation={userLocation}
            onLocationUpdate={onLocationUpdate}
            onSelectIssue={onOpenIssue}
            height="320px"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Needs attention */}
        <section className="space-y-3 lg:col-span-7" aria-labelledby="attention-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="attention-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <AlertOctagon className="h-4 w-4 text-rose-400" aria-hidden="true" />
              Needs supervisor attention ({criticalIssues.length})
            </h2>
            <span className="font-mono text-[11px] text-slate-500">Critical &amp; high priority</span>
          </div>

          {criticalIssues.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No critical incidents open"
              description="Every high and critical severity report is resolved or already assigned."
            />
          ) : (
            <div className="space-y-3">
              {criticalIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onOpenIssue(issue)}
                  className="rg-card rg-card-interactive block w-full space-y-3 p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-300">{issue.referenceNumber}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {new Date(issue.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={issue.severity} />
                    <StatusBadge status={issue.status} />
                    <span className="text-xs text-slate-400">
                      {issue.assignedWorkerName ? issue.assignedWorkerName.split(' ')[0] : 'Unassigned'}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold leading-snug text-slate-100">{issue.title}</h3>

                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">
                      {issue.location.street || issue.location.area}, {issue.location.city}
                    </span>
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-700/40 pt-2.5 font-mono text-[11px] text-slate-500">
                    <span>{statusLabel(issue.status)}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-400">
                      Manage incident
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section className="space-y-3 lg:col-span-5" aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Recent municipal activity
          </h2>

          {recentTimeline.length === 0 ? (
            <EmptyState icon={Clock} title="No activity recorded yet" description="Timeline events appear as reports move through inspection and repair." />
          ) : (
            <div className="rg-panel space-y-3 rounded-xl p-4">
              {recentTimeline.map((item, idx) => (
                <button
                  key={`${item.issueRef}-${idx}`}
                  type="button"
                  onClick={() => onOpenIssue(item.issue)}
                  className="flex w-full items-start gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-800/40"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                  <span className="min-w-0 space-y-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                      <span className="font-mono text-[10px] text-slate-500">{item.issueRef}</span>
                    </span>
                    <span className="block truncate text-xs text-slate-400">{item.description}</span>
                    <span className="block font-mono text-[10px] text-slate-500">
                      {item.timestamp} · {item.actor || 'Municipal system'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
