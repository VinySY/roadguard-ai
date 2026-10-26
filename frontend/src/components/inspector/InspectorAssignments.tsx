import React from 'react';
import { RoadIssue, User } from '../../types';
import { storage, DEMO_USERS } from '../../services/storage';
import { UserCheck, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { EmptyState } from '../common/EmptyState';

interface InspectorAssignmentsProps {
  issues: RoadIssue[];
  currentUser: User;
  onIssueUpdated: (updated: RoadIssue) => void;
  onOpenIssue: (issue: RoadIssue) => void;
}

export const InspectorAssignments: React.FC<InspectorAssignmentsProps> = ({
  issues,
  currentUser,
  onIssueUpdated,
  onOpenIssue,
}) => {
  const workers = [
    {
      ...DEMO_USERS.worker,
      activeTasks: issues.filter((i) => i.assignedWorkerId === DEMO_USERS.worker.id && i.status !== 'resolved').length,
    },
    {
      id: 'user-wrk-02',
      name: 'Surjit Singh (Crew 2)',
      email: 'surjit.s@mcc-demo.gov.in',
      role: 'worker' as const,
      assignedZone: 'Sector 34 & 35 Corridor',
      activeTasks: issues.filter((i) => i.assignedWorkerId === 'user-wrk-02' && i.status !== 'resolved').length,
    },
  ];

  const unassignedIssues = issues.filter((i) => !i.assignedWorkerId && i.status !== 'resolved');

  const handleQuickAssign = (issueId: string, workerId: string, workerName: string) => {
    const updated = storage.assignWorkerToIssue(issueId, workerId, workerName);
    if (updated) {
      onIssueUpdated(updated);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        eyebrow={
          <>
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Dispatch &amp; crew workload
          </>
        }
        icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
        title="Crew workload & dispatch"
        description="Distribute incoming road repair tickets across quick-response municipal asphalt crews."
      />

      {/* Field crew capacity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {workers.map((worker) => (
          <div key={worker.id} className="rg-panel space-y-3 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400">
                  {worker.name[0]}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{worker.name}</h4>
                  <p className="text-xs text-slate-400">{worker.assignedZone}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                  {worker.activeTasks}
                </span>
                <span className="text-[11px] text-slate-500 block">active tasks</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned Issues Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Unassigned Road Issues Awaiting Dispatch ({unassignedIssues.length})</span>
          </h3>
        </div>

        {unassignedIssues.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All active road issues are assigned"
            description="Every open ticket has a field crew attached. New reports appear here for dispatch."
          />
        ) : (
          <div className="space-y-3">
            {unassignedIssues.map((issue) => (
              <div
                key={issue.id}
                className="rg-card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {issue.referenceNumber}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-xs font-semibold capitalize text-rose-400">
                      {issue.severity}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">{issue.title}</h4>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{issue.location.street || issue.location.area}, {issue.location.city}</span>
                  </p>
                </div>

                <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t border-slate-800/80 sm:border-0">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const w = workers.find((item) => item.id === e.target.value);
                      if (w) {
                        handleQuickAssign(issue.id, w.id, w.name);
                      }
                    }}
                    className="rg-select flex-1 !py-2 text-xs sm:flex-initial"
                    aria-label={`Assign ${issue.referenceNumber} to a crew`}
                  >
                    <option value="" disabled>
                      Assign to Crew...
                    </option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.activeTasks} tasks)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onOpenIssue(issue)}
                    className="rg-btn rg-btn-secondary rg-btn-sm shrink-0"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
