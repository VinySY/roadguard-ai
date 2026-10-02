import React, { useState } from 'react';
import { RoadIssue, SeverityLevel, IssueStatus, User } from '../../types';
import { storage, DEMO_USERS } from '../../services/storage';
import {
  Search,
  Filter,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Building2,
  ChevronRight,
  X,
  Mail,
} from 'lucide-react';
import { MunicipalEmailModal } from '../reporting/MunicipalEmailModal';

interface RoadIssuesViewProps {
  issues: RoadIssue[];
  currentUser: User;
  onIssueUpdated: (updated: RoadIssue) => void;
  selectedIssueId?: string | null;
}

export const RoadIssuesView: React.FC<RoadIssuesViewProps> = ({
  issues,
  currentUser,
  onIssueUpdated,
  selectedIssueId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeIssue, setActiveIssue] = useState<RoadIssue | null>(
    selectedIssueId ? issues.find((i) => i.id === selectedIssueId) || null : null
  );
  const [emailModalIssue, setEmailModalIssue] = useState<RoadIssue | null>(null);

  const workers = [DEMO_USERS.worker, { id: 'user-wrk-02', name: 'Surjit Singh (Crew 2)', role: 'worker' as const }];

  const filteredIssues = issues.filter((issue) => {
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(term);
      const matchRef = issue.referenceNumber.toLowerCase().includes(term);
      const matchLoc = (issue.location.street || issue.location.area || '').toLowerCase().includes(term);
      if (!matchTitle && !matchRef && !matchLoc) return false;
    }
    return true;
  });

  const handleAssignWorker = (issueId: string, workerId: string, workerName: string) => {
    const updated = storage.assignWorkerToIssue(issueId, workerId, workerName);
    if (updated) {
      onIssueUpdated(updated);
      if (activeIssue && activeIssue.id === issueId) {
        setActiveIssue(updated);
      }
    }
  };

  const handleStatusChange = (issueId: string, newStatus: IssueStatus) => {
    const updated = storage.updateIssueStatus(
      issueId,
      newStatus,
      currentUser.name,
      `Inspector updated status to ${newStatus.replace(/_/g, ' ')}`
    );
    if (updated) {
      onIssueUpdated(updated);
      if (activeIssue && activeIssue.id === issueId) {
        setActiveIssue(updated);
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Municipal Road Issues Registry</h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete database of reported roadway defects, field assessments, and repair statuses.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar in normal document flow */}
      <div className="bg-slate-900 rounded-xl border border-slate-800/90 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by roadway, sector, or reference ID..."
              className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Symmetrical Dropdowns on Mobile, inline on Desktop */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full sm:w-auto h-10 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto h-10 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="notified_municipality">Municipality Notified</option>
              <option value="inspection_scheduled">Inspection Scheduled</option>
              <option value="in_repair">In Repair</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Active Filters */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800/60">
          <span>
            Showing <strong className="text-slate-200 font-semibold">{filteredIssues.length}</strong> of {issues.length} records
          </span>
          {(severityFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setSeverityFilter('all');
                setStatusFilter('all');
                setSearchTerm('');
              }}
              className="text-amber-400 hover:underline font-sans text-xs font-medium"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-3">
        {filteredIssues.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-200">No road issues found</h4>
            <p className="text-xs text-slate-400">Try adjusting your search query or severity/status filter.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => setActiveIssue(issue)}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-850 active:bg-slate-800 active:scale-[0.995] transition-all cursor-pointer space-y-3 shadow-sm group select-none"
            >
              {/* Reference & Refined Metadata Row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-300 group-hover:text-amber-400 transition-colors">
                    {issue.referenceNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(issue.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${
                      issue.severity === 'critical'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : issue.severity === 'high'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : issue.severity === 'medium'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-slate-400">
                    {issue.assignedWorkerName ? issue.assignedWorkerName.split(' ')[0] : 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Primary Info: Issue Title */}
              <h4 className="text-sm font-semibold text-slate-100 group-hover:text-amber-400 transition-colors leading-snug">
                {issue.title}
              </h4>

              {/* Secondary Info: Location */}
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{issue.location.street || issue.location.area}, {issue.location.city}</span>
              </p>

              {/* Tertiary Info: SLA & Action */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
                <div className="flex items-center gap-1.5">
                  <span>SLA Target: 24h</span>
                  <span className="text-slate-600">·</span>
                  <span className="capitalize text-slate-400">{issue.status.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-amber-400 font-medium text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Manage Incident</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Issues Table (Desktop View >= md) */}
      <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Roadway & Location</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Crew</th>
                <th className="py-3 px-4">Reported Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredIssues.map((issue) => {
                const severityBadge =
                  issue.severity === 'critical'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : issue.severity === 'high'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                return (
                  <tr
                    key={issue.id}
                    onClick={() => setActiveIssue(issue)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                      {issue.referenceNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div>{issue.title}</div>
                      <span className="text-[11px] text-slate-400 font-normal">
                        {issue.location.street || issue.location.area}, {issue.location.city}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border capitalize ${severityBadge}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-300">
                      {issue.status.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {issue.assignedWorkerName ? (
                        <span className="text-slate-200">{issue.assignedWorkerName}</span>
                      ) : (
                        <span className="text-rose-400 font-medium text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                      {new Date(issue.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveIssue(issue);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-medium text-xs inline-flex items-center gap-1"
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over Incident Management Drawer */}
      {activeIssue && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 text-slate-100 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  {activeIssue.referenceNumber}
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-2">{activeIssue.title}</h3>
              </div>
              <button
                onClick={() => setActiveIssue(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Evidence & Location */}
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-52 flex items-center justify-center">
                <img
                  src={activeIssue.evidenceImageUrl}
                  alt="Evidence"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {activeIssue.location.street || 'Site roadway'}, {activeIssue.location.area},{' '}
                    {activeIssue.location.city}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {activeIssue.location.lat.toFixed(4)}°N, {activeIssue.location.lng.toFixed(4)}°E
                </div>
              </div>
            </div>

            {/* Status & Crew Assignment Form */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Supervisor Controls
              </h4>

              {/* Status Update */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium">Update Status</label>
                <select
                  value={activeIssue.status}
                  onChange={(e) => handleStatusChange(activeIssue.id, e.target.value as IssueStatus)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="reported">Reported</option>
                  <option value="notified_municipality">Municipality Notified</option>
                  <option value="inspection_scheduled">Inspection Scheduled</option>
                  <option value="in_repair">In Repair</option>
                  <option value="resolved">Resolved & Certified</option>
                </select>
              </div>

              {/* Worker Assignment */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium">Assign Field Crew</label>
                <select
                  value={activeIssue.assignedWorkerId || ''}
                  onChange={(e) => {
                    const w = workers.find((item) => item.id === e.target.value);
                    if (w) {
                      handleAssignWorker(activeIssue.id, w.id, w.name);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Select Field Technician --</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Municipal Transmittal Action */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => setEmailModalIssue(activeIssue)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Transmit Official Municipal Email</span>
                </button>
              </div>
            </div>

            {/* Inspection Checklist Review (if present) */}
            {activeIssue.inspection && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Field Inspection Notes ({activeIssue.assignedWorkerName || 'Crew'})
                </h4>
                <p className="text-slate-300 italic">{activeIssue.inspection.notes || 'Routine patch logged.'}</p>
                {activeIssue.inspection.measurements && (
                  <div className="font-mono text-slate-400 pt-1 text-[11px]">
                    Measurements: {activeIssue.inspection.measurements.estimatedDepthCm}cm depth ×{' '}
                    {activeIssue.inspection.measurements.estimatedWidthCm}cm width
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Municipal Email Modal */}
      {emailModalIssue && (
        <MunicipalEmailModal
          isOpen={true}
          onClose={() => setEmailModalIssue(null)}
          issue={emailModalIssue}
        />
      )}
    </div>
  );
};
