import React, { useEffect, useState } from 'react';
import { RoadIssue, IssueStatus, User } from '../../types';
import { MapPin, CheckCircle2, AlertCircle, Building2, Plus } from 'lucide-react';
import { DetectionMedia } from '../common/DetectionMedia';
import { SeverityBadge, StatusBadge, statusLabel } from '../common/StatusBadge';
import { PageHeader } from '../common/PageHeader';
import { EmptyState } from '../common/EmptyState';

interface CustomerReportsViewProps {
  issues: RoadIssue[];
  currentUser: User | null;
  onOpenReportModal: () => void;
  selectedIssueId?: string | null;
  onCloseDetail?: () => void;
}

export const CustomerReportsView: React.FC<CustomerReportsViewProps> = ({
  issues,
  currentUser,
  onOpenReportModal,
  selectedIssueId,
  onCloseDetail,
}) => {
  const [activeIssueId, setActiveIssueId] = useState<string | null>(
    selectedIssueId || (issues.length > 0 ? issues[0].id : null)
  );

  useEffect(() => {
    if (selectedIssueId) setActiveIssueId(selectedIssueId);
  }, [selectedIssueId]);

  const myReports = issues.filter(
    (i) =>
      i.reportedBy.userId === currentUser?.id ||
      (!currentUser && i.reportedBy.isGuest) ||
      i.reportedBy.name === currentUser?.name
  );

  const activeIssue = issues.find((i) => i.id === activeIssueId) || myReports[0];

  const standardMilestones: { status: IssueStatus; label: string; desc: string }[] = [
    { status: 'reported', label: 'Report Submitted', desc: 'Incident recorded with verified GPS coordinates & photo evidence.' },
    { status: 'notified_municipality', label: 'Municipality Notified', desc: 'Formal alert dispatched to regional public works department.' },
    { status: 'inspection_scheduled', label: 'Inspection Scheduled', desc: 'Assigned to field technician for depth assessment & cone placement.' },
    { status: 'in_repair', label: 'Repair Underway', desc: 'Road crew active on site with hot/cold mix asphalt compaction.' },
    { status: 'resolved', label: 'Resolved & Certified', desc: 'Rideability verified by municipal inspection supervisor.' },
  ];

  const getMilestoneState = (milestoneStatus: IssueStatus, currentStatus: IssueStatus) => {
    const order: IssueStatus[] = ['reported', 'notified_municipality', 'inspection_scheduled', 'in_repair', 'resolved'];
    const currentIndex = order.indexOf(currentStatus);
    const targetIndex = order.indexOf(milestoneStatus);

    if (targetIndex < currentIndex) return 'completed';
    if (targetIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <PageHeader
        eyebrow="Citizen workspace / Report tracking"
        title="My Road Reports"
        description="Track official municipal progress on road repairs you have submitted."
        actions={
          <button type="button" onClick={onOpenReportModal} className="rg-btn rg-btn-primary">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Report another problem
          </button>
        }
      />

      {myReports.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No reports on file"
          description="You haven't reported any potholes yet. Log an issue to track municipal remediation in real time."
          action={
            <button type="button" onClick={onOpenReportModal} className="rg-btn rg-btn-primary">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Report a road problem
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Reports List (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">
              Submitted Incidents ({myReports.length})
            </span>

            {myReports.map((issue) => {
              const isSelected = activeIssue?.id === issue.id;

              return (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setActiveIssueId(issue.id)}
                  aria-pressed={isSelected}
                  className={`block w-full select-none space-y-2.5 rounded-xl border p-4 text-left shadow-sm transition-all active:scale-[0.995] ${
                    isSelected
                      ? 'border-amber-500/60 bg-slate-800/80 ring-1 ring-amber-500/20'
                      : 'border-slate-800/90 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {issue.referenceNumber}
                    </span>
                    <SeverityBadge severity={issue.severity} />
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100 line-clamp-1 leading-snug">
                    {issue.title}
                  </h4>

                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{issue.location.street || issue.location.area}, {issue.location.city}</span>
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
                    <span className="capitalize text-slate-400 font-sans">{statusLabel(issue.status)}</span>
                    <span className="text-amber-400 text-xs font-medium font-sans">
                      {isSelected ? 'Viewing timeline' : 'View details'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Timeline View (Right Column) */}
          {activeIssue && (
            <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-sm">
              {/* Header Info */}
              <div className="pb-4 border-b border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    {activeIssue.referenceNumber}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Reported on {new Date(activeIssue.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={activeIssue.status} />
                  <SeverityBadge severity={activeIssue.severity} />
                </div>

                <h3 className="text-lg font-bold text-slate-100">{activeIssue.title}</h3>
                <p className="text-xs text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    {activeIssue.location.street}, {activeIssue.location.area}, {activeIssue.location.city}
                  </span>
                </p>
              </div>

              {/* Responsible Municipal Desk */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Responsible Municipal Cell:</span>
                    <span className="text-slate-200 font-medium">{activeIssue.municipalityName}</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">Official Channel</span>
              </div>

              {/* Photographic / video Evidence Preview */}
              <div>
                <span className="text-xs font-medium text-slate-400 block mb-2">
                  {activeIssue.evidenceVideoUrl ? 'Video evidence' : 'Photographic evidence'}
                </span>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-1.5">
                  <DetectionMedia
                    imageSrc={activeIssue.evidenceImageUrl}
                    videoSrc={activeIssue.evidenceVideoUrl}
                    detection={activeIssue.detectionData}
                    alt={`Road evidence for ${activeIssue.referenceNumber}`}
                    caption={`${activeIssue.location.street || activeIssue.location.area} · ${new Date(activeIssue.createdAt).toLocaleDateString()}`}
                    maxHeightClassName="max-h-64"
                    allowFullView
                  />
                </div>
                {activeIssue.detectionData && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="rg-badge rg-badge-amber">
                      {activeIssue.detectionData.potholeCount} cavities detected
                    </span>
                    <SeverityBadge severity={activeIssue.severity} />
                  </div>
                )}
              </div>

              {/* Clean Human-Centered Timeline (Requirement 20) */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Remediation Progress Timeline
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {standardMilestones.map((milestone, idx) => {
                    const state = getMilestoneState(milestone.status, activeIssue.status);

                    return (
                      <div key={idx} className="relative flex items-start gap-3">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-6 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                            state === 'completed'
                              ? 'bg-emerald-500 text-slate-950'
                              : state === 'current'
                              ? 'bg-amber-500 ring-4 ring-amber-500/20 text-slate-950'
                              : 'bg-slate-800 border border-slate-700 text-slate-600'
                          }`}
                        >
                          {state === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : state === 'current' ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></div>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                state === 'completed'
                                  ? 'text-slate-200'
                                  : state === 'current'
                                  ? 'text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {milestone.label}
                            </span>
                            {state === 'current' && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400">
                                In Progress
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {milestone.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
