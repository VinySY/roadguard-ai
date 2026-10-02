import React from 'react';
import { RoadIssue, User } from '../../types';
import { storage, DEMO_USERS } from '../../services/storage';
import { UserCheck, MapPin, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

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
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100">Crew Workload & Dispatch Assignments</h2>
        <p className="text-xs text-slate-400 mt-1">
          Distribute incoming road repair tickets across quick-response municipal asphalt crews.
        </p>
      </div>

      {/* Field Crew Capacity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workers.map((worker) => (
          <div key={worker.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
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
          <div className="p-10 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-200 font-medium">All active road issues are assigned to field crews.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unassignedIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                    className="flex-1 sm:flex-initial bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    onClick={() => onOpenIssue(issue)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg shrink-0 transition-colors"
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
