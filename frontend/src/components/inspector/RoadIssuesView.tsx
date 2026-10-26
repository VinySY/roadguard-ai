import React, { useEffect, useState } from 'react';
import { RoadIssue, SeverityLevel, IssueStatus, User } from '../../types';
import { storage, DEMO_USERS } from '../../services/storage';
import {
  Search,
  MapPin,
  AlertTriangle,
  ChevronRight,
  X,
  Mail,
  Layers,
} from 'lucide-react';
import { MunicipalEmailModal } from '../reporting/MunicipalEmailModal';
import { EvidenceImage } from '../common/EvidenceImage';
import { PageHeader } from '../common/PageHeader';
import { EmptyState } from '../common/EmptyState';
import { SeverityBadge, StatusBadge } from '../common/StatusBadge';

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

  // Keep the drawer selection in sync with map / dashboard deep links.
  useEffect(() => {
    if (selectedIssueId) {
      setActiveIssue(issues.find((i) => i.id === selectedIssueId) || null);
    }
  }, [selectedIssueId, issues]);

  // Escape closes the incident drawer.
  useEffect(() => {
    if (!activeIssue) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIssue(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeIssue]);

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
      <PageHeader
        eyebrow={
          <>
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Municipal registry
          </>
        }
        icon={<Layers className="h-4 w-4" aria-hidden="true" />}
        title="Road issues registry"
        description="Complete database of reported roadway defects, field assessments, and repair statuses."
      />

      {/* Filters */}
      <div className="rg-panel space-y-3 rounded-xl p-3.5 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by roadway, sector, or reference ID…"
              aria-label="Search road issues"
              className="rg-input h-10 !pl-9 !pr-8"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 p-1 text-slate-500 hover:text-slate-300"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | 'all')}
              aria-label="Filter by severity"
              className="rg-select h-10 !py-2 sm:w-auto"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="rg-select h-10 !py-2 sm:w-auto"
            >
              <option value="all">All statuses</option>
              <option value="reported">Reported</option>
              <option value="notified_municipality">Municipality notified</option>
              <option value="inspection_scheduled">Inspection scheduled</option>
              <option value="in_repair">In repair</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700/40 pt-2 font-mono text-[11px] text-slate-400">
          <span>
            Showing <strong className="font-semibold text-slate-200">{filteredIssues.length}</strong> of {issues.length}{' '}
            records
          </span>
          {(severityFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('all');
                setStatusFilter('all');
                setSearchTerm('');
              }}
              className="font-sans text-xs font-medium text-amber-400 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile card list (< md) */}
      <div className="space-y-3 md:hidden">
        {filteredIssues.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No road issues found"
            description="Try adjusting your search query or severity and status filters."
          />
        ) : (
          filteredIssues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => setActiveIssue(issue)}
              className="rg-card rg-card-interactive block w-full space-y-3 p-4 text-left"
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
                  <SeverityBadge severity={issue.severity} />
                  <span className="text-slate-600" aria-hidden="true">·</span>
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

              {/* Tertiary info */}
              <div className="flex items-center justify-between border-t border-slate-700/40 pt-2.5 font-mono text-[11px] text-slate-500">
                <StatusBadge status={issue.status} />
                <span className="flex items-center gap-1 text-xs font-medium text-amber-400">
                  <span>Manage incident</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Issues table (desktop >= md) */}
      <div className="rg-panel hidden overflow-hidden rounded-xl md:block">
        {filteredIssues.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No road issues match the filters"
            description="Adjust the search term, severity, or status filter to widen the registry view."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="rg-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Roadway &amp; location</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Assigned crew</th>
                  <th>Reported</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    tabIndex={0}
                    onClick={() => setActiveIssue(issue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveIssue(issue);
                      }
                    }}
                    aria-label={`Open ${issue.referenceNumber}: ${issue.title}`}
                    className="cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-400"
                  >
                    <td className="font-mono font-semibold text-amber-400">{issue.referenceNumber}</td>
                    <td className="font-medium text-slate-200">
                      <div>{issue.title}</div>
                      <span className="text-[11px] font-normal text-slate-400">
                        {issue.location.street || issue.location.area}, {issue.location.city}
                      </span>
                    </td>
                    <td>
                      <SeverityBadge severity={issue.severity} />
                    </td>
                    <td>
                      <StatusBadge status={issue.status} />
                    </td>
                    <td>
                      {issue.assignedWorkerName ? (
                        <span className="text-slate-200">{issue.assignedWorkerName}</span>
                      ) : (
                        <span className="text-xs font-medium text-rose-400">Unassigned</span>
                      )}
                    </td>
                    <td className="font-mono tabular-nums text-slate-500">
                      {new Date(issue.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveIssue(issue);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                      >
                        <span>Manage</span>
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over incident management drawer */}
      {activeIssue && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm rg-animate-fade">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-drawer-title"
            className="w-full max-w-xl space-y-6 overflow-y-auto border-l border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-400">
                  {activeIssue.referenceNumber}
                </span>
                <h3 id="issue-drawer-title" className="mt-2 text-base font-bold text-slate-100">
                  {activeIssue.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveIssue(null)}
                className="rg-icon-btn"
                aria-label="Close incident details"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Evidence & Location */}
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-52 flex items-center justify-center">
                <EvidenceImage
                  src={activeIssue.evidenceImageUrl}
                  alt={`Pothole evidence for ${activeIssue.referenceNumber}`}
                  caption={activeIssue.location.street || activeIssue.location.area}
                  className="h-52 w-full"
                  imgClassName="w-full h-full object-cover"
                  allowFullView
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

              {/* Status update */}
              <div>
                <label htmlFor="issue-status-select" className="mb-1 block text-[11px] font-medium text-slate-400">
                  Update status
                </label>
                <select
                  id="issue-status-select"
                  value={activeIssue.status}
                  onChange={(e) => handleStatusChange(activeIssue.id, e.target.value as IssueStatus)}
                  className="rg-select"
                >
                  <option value="reported">Reported</option>
                  <option value="notified_municipality">Municipality notified</option>
                  <option value="inspection_scheduled">Inspection scheduled</option>
                  <option value="in_repair">In repair</option>
                  <option value="resolved">Resolved &amp; certified</option>
                </select>
              </div>

              {/* Worker assignment */}
              <div>
                <label htmlFor="issue-worker-select" className="mb-1 block text-[11px] font-medium text-slate-400">
                  Assign field crew
                </label>
                <select
                  id="issue-worker-select"
                  value={activeIssue.assignedWorkerId || ''}
                  onChange={(e) => {
                    const w = workers.find((item) => item.id === e.target.value);
                    if (w) {
                      handleAssignWorker(activeIssue.id, w.id, w.name);
                    }
                  }}
                  className="rg-select"
                >
                  <option value="">Select field technician</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Municipal transmittal */}
              <div className="border-t border-slate-800 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModalIssue(activeIssue)}
                  className="rg-btn rg-btn-secondary w-full"
                >
                  <Mail className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <span>Transmit official municipal email</span>
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
