import React from 'react';
import { RoadIssue, LocationCoordinates, User } from '../../types';
import { calculateDistanceKm } from '../../services/location';
import { LeafletMap } from '../map/LeafletMap';
import {
  Wrench,
  Navigation,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  ArrowRight,
  ClipboardList,
  Camera,
} from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { StatCard } from '../common/StatCard';
import { SeverityBadge, StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';

interface WorkerDashboardProps {
  currentUser: User;
  issues: RoadIssue[];
  userLocation: LocationCoordinates | null;
  onOpenTask: (issue: RoadIssue) => void;
  onNavigateToMap: () => void;
  onNavigateToDetection: () => void;
  onLocationUpdate?: (coords: LocationCoordinates) => void;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  currentUser,
  issues,
  userLocation,
  onOpenTask,
  onNavigateToMap,
  onNavigateToDetection,
  onLocationUpdate,
}) => {
  // Tasks assigned to this worker, plus unclaimed open work.
  const assignedTasks = issues.filter(
    (i) => i.assignedWorkerId === currentUser.id || (!i.assignedWorkerId && i.status !== 'resolved')
  );

  const pendingTasks = assignedTasks.filter(
    (i) =>
      i.status === 'inspection_scheduled' ||
      i.status === 'notified_municipality' ||
      i.status === 'reported'
  );

  const inRepairTasks = assignedTasks.filter((i) => i.status === 'in_repair');
  const completedTasks = assignedTasks.filter((i) => i.status === 'resolved');
  const highPriorityTasks = assignedTasks.filter(
    (i) => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved'
  );

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow={
          <>
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            Field crew workspace
          </>
        }
        icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        title={`Today's field work — ${currentUser.name}`}
        description={
          <>
            Assigned zone:{' '}
            <span className="font-medium text-amber-400">{currentUser.assignedZone || 'All sectors'}</span>. Prioritised
            work orders, navigation, and field evidence capture.
          </>
        }
        actions={
          <button type="button" onClick={onNavigateToDetection} className="rg-btn rg-btn-primary">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Field camera &amp; inspection
          </button>
        }
      />

      <section aria-label="Field workload" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Assigned tasks" value={assignedTasks.length} note="In your queue" icon={ClipboardList} />
        <StatCard
          label="Pending inspection"
          value={pendingTasks.length}
          note="Awaiting site visit"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="In remediation"
          value={inRepairTasks.length}
          note="Repair underway"
          icon={Wrench}
          tone="info"
        />
        <StatCard
          label="Completed"
          value={completedTasks.length}
          note="Certified repairs"
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Priority queue */}
        <section className="space-y-3 lg:col-span-7" aria-labelledby="priority-tasks-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="priority-tasks-heading"
              className="flex items-center gap-2 text-sm font-semibold text-slate-100"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Priority field tasks ({highPriorityTasks.length})
            </h2>
            <span className="font-mono text-[11px] text-slate-500">Sorted by urgency</span>
          </div>

          {highPriorityTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No high-priority tasks open"
              description="All critical and high severity work in your queue is complete. Routine maintenance remains available."
            />
          ) : (
            <div className="space-y-3">
              {highPriorityTasks.map((task) => {
                const distanceStr = userLocation
                  ? `${calculateDistanceKm(
                      userLocation.lat,
                      userLocation.lng,
                      task.location.lat,
                      task.location.lng
                    )} km`
                  : null;

                return (
                  <article key={task.id} className="rg-card space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-300">{task.referenceNumber}</span>
                        {distanceStr && (
                          <>
                            <span className="text-slate-600" aria-hidden="true">
                              ·
                            </span>
                            <span className="flex items-center gap-1 font-mono text-xs text-sky-400">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {distanceStr}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <SeverityBadge severity={task.severity} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>

                    <h3 className="text-sm font-semibold leading-snug text-slate-100">{task.title}</h3>

                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                      <span className="truncate">
                        {task.location.street || task.location.area}, {task.location.city}
                      </span>
                    </p>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-700/40 pt-2.5">
                      <span className="font-mono text-[11px] text-slate-500">
                        {task.severity === 'critical' ? 'Immediate response' : 'High priority'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${task.location.lat},${task.location.lng}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="rg-btn rg-btn-secondary rg-btn-sm"
                        >
                          <Navigation className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                          GPS
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenTask(task)}
                          className="rg-btn rg-btn-primary rg-btn-sm"
                        >
                          Open task
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Route map */}
        <section className="space-y-3 lg:col-span-5" aria-labelledby="route-map-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="route-map-heading" className="text-sm font-semibold text-slate-100">
              Assigned road issues
            </h2>
            <button
              type="button"
              onClick={onNavigateToMap}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
            >
              Full route view
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-700/60 shadow-lg">
            <LeafletMap
              issues={issues}
              role="worker"
              workerId={currentUser.id}
              userLocation={userLocation}
              onLocationUpdate={onLocationUpdate}
              onSelectIssue={onOpenTask}
              height="380px"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
