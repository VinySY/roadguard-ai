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
  Compass,
} from 'lucide-react';

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
  // Filter issues assigned to this worker (or unassigned priority tasks in their zone)
  const assignedTasks = issues.filter(
    (i) => i.assignedWorkerId === currentUser.id || (!i.assignedWorkerId && i.status !== 'resolved')
  );

  const pendingTasks = assignedTasks.filter(
    (i) => i.status === 'inspection_scheduled' || i.status === 'notified_municipality' || i.status === 'reported'
  );

  const inRepairTasks = assignedTasks.filter((i) => i.status === 'in_repair');
  const completedTasks = assignedTasks.filter((i) => i.status === 'resolved');
  const highPriorityTasks = assignedTasks.filter(
    (i) => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved'
  );

  return (
    <div className="space-y-6 w-full">
      {/* Worker Greeting & Shift Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-400 font-mono">Shift Active · Quick Response Crew</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-100">
            Today's Field Work — {currentUser.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Assigned Zone: <span className="text-amber-400 font-medium">{currentUser.assignedZone || 'Sector 17 & 22'}</span>
          </p>
        </div>

        <button
          onClick={onNavigateToDetection}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm self-start sm:self-auto"
        >
          <Wrench className="w-4 h-4" />
          Field Camera & Inspection
        </button>
      </div>

      {/* Action-Oriented Counters (Requirement 13) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Assigned Tasks</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {assignedTasks.length}
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Pending Field Inspection</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {pendingTasks.length}
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">In Active Remediation</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-blue-400 tabular-nums">
            {inRepairTasks.length}
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Completed / Certified</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {completedTasks.length}
          </span>
        </div>
      </div>

      {/* Priority Tasks Grid & Worker Assigned Route Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Priority Field Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Priority Field Tasks ({highPriorityTasks.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Sorted by urgency</span>
          </div>

          {highPriorityTasks.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-200 font-medium">All high-priority road tasks addressed!</p>
              <p className="text-xs text-slate-500">Check standard queue for routine maintenance.</p>
            </div>
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

                const severityColor =
                  task.severity === 'critical' ? 'text-rose-400' : 'text-amber-400';

                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-850 active:bg-slate-800 active:scale-[0.995] transition-all space-y-3 shadow-sm select-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {task.referenceNumber}
                        </span>
                        {distanceStr && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-xs font-mono text-sky-400">📍 {distanceStr}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${
                            task.severity === 'critical'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {task.severity}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-100 leading-snug">{task.title}</h4>

                    <p className="text-xs text-slate-400 line-clamp-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{task.location.street || task.location.area}, {task.location.city}</span>
                    </p>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-500 text-[11px] font-mono">
                        SLA Target: 24h
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${task.location.lat},${task.location.lng}`;
                            window.open(url, '_blank');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-amber-400" />
                          <span>GPS</span>
                        </button>
                        <button
                          onClick={() => onOpenTask(task)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                        >
                          <span>Open Task</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Worker Assigned Issues Route Map (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Assigned Road Issues</h3>
            <button
              onClick={onNavigateToMap}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              Full Route View &rarr;
            </button>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-sm">
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
        </div>
      </div>
    </div>
  );
};
