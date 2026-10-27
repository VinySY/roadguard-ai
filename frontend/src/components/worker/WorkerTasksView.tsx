import React, { useEffect, useState } from 'react';
import { RoadIssue, IssueStatus, User } from '../../types';
import { storage } from '../../services/storage';
import {
  Navigation,
  CheckCircle2,
  Save,
  CheckSquare,
  Square,
  ArrowLeft,
  Wrench,
  ClipboardList,
} from 'lucide-react';
import { DetectionMedia } from '../common/DetectionMedia';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';

interface WorkerTasksViewProps {
  issues: RoadIssue[];
  currentUser: User;
  selectedIssueId?: string | null;
  onClose?: () => void;
  onIssueUpdated: (updated: RoadIssue) => void;
}

export const WorkerTasksView: React.FC<WorkerTasksViewProps> = ({
  issues,
  currentUser,
  selectedIssueId,
  onClose,
  onIssueUpdated,
}) => {
  const [activeIssueId, setActiveIssueId] = useState<string | null>(
    selectedIssueId || (issues.length > 0 ? issues[0].id : null)
  );

  const activeIssue = issues.find((i) => i.id === activeIssueId) || issues[0];

  // Local state for the active inspection form
  const [depthCm, setDepthCm] = useState<number>(
    activeIssue?.inspection?.measurements?.estimatedDepthCm || 8
  );
  const [widthCm, setWidthCm] = useState<number>(
    activeIssue?.inspection?.measurements?.estimatedWidthCm || 60
  );
  const [lengthCm, setLengthCm] = useState<number>(
    activeIssue?.inspection?.measurements?.estimatedLengthCm || 80
  );

  const [checklist, setChecklist] = useState({
    depthMeasured: activeIssue?.inspection?.checklist?.depthMeasured ?? true,
    trafficSafetyConePlaced: activeIssue?.inspection?.checklist?.trafficSafetyConePlaced ?? true,
    pavementCrackingAssessed: activeIssue?.inspection?.checklist?.pavementCrackingAssessed ?? false,
    utilityInterferenceChecked: activeIssue?.inspection?.checklist?.utilityInterferenceChecked ?? false,
    asphaltBatchRequested: activeIssue?.inspection?.checklist?.asphaltBatchRequested ?? false,
  });

  const [notes, setNotes] = useState<string>(activeIssue?.inspection?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Keep the selected task in sync with map / dashboard deep links.
  useEffect(() => {
    if (selectedIssueId) setActiveIssueId(selectedIssueId);
  }, [selectedIssueId]);

  // Load the newly selected task's saved inspection values into the form.
  useEffect(() => {
    const issue = issues.find((i) => i.id === activeIssueId);
    if (!issue) return;
    setDepthCm(issue.inspection?.measurements?.estimatedDepthCm ?? 8);
    setWidthCm(issue.inspection?.measurements?.estimatedWidthCm ?? 60);
    setLengthCm(issue.inspection?.measurements?.estimatedLengthCm ?? 80);
    setNotes(issue.inspection?.notes ?? '');
    setChecklist({
      depthMeasured: issue.inspection?.checklist?.depthMeasured ?? true,
      trafficSafetyConePlaced: issue.inspection?.checklist?.trafficSafetyConePlaced ?? true,
      pavementCrackingAssessed: issue.inspection?.checklist?.pavementCrackingAssessed ?? false,
      utilityInterferenceChecked: issue.inspection?.checklist?.utilityInterferenceChecked ?? false,
      asphaltBatchRequested: issue.inspection?.checklist?.asphaltBatchRequested ?? false,
    });
  }, [activeIssueId, issues]);

  if (!activeIssue) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No assigned tasks in your queue"
        description="New work orders appear here once a municipal inspector assigns them to your crew."
      />
    );
  }

  const toggleChecklist = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdateStatus = (newStatus: IssueStatus) => {
    setIsSaving(true);
    const updated = storage.updateIssueStatus(
      activeIssue.id,
      newStatus,
      currentUser.name,
      notes || `Status advanced to ${newStatus.replace(/_/g, ' ')}`
    );

    if (updated) {
      // Save inspection details
      updated.inspection = {
        workerId: currentUser.id,
        workerName: currentUser.name,
        scheduledDate: new Date().toISOString().split('T')[0],
        inspectedAt: new Date().toISOString(),
        checklist,
        notes,
        measurements: {
          estimatedDepthCm: depthCm,
          estimatedWidthCm: widthCm,
          estimatedLengthCm: lengthCm,
        },
      };
      storage.saveIssue(updated);
      onIssueUpdated(updated);
      setStatusMessage(`Status updated to ${newStatus.replace(/_/g, ' ')} successfully.`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
    setIsSaving(false);
  };

  const handleSaveNotes = () => {
    setIsSaving(true);
    const updated = { ...activeIssue };
    updated.inspection = {
      workerId: currentUser.id,
      workerName: currentUser.name,
      scheduledDate: new Date().toISOString().split('T')[0],
      inspectedAt: new Date().toISOString(),
      checklist,
      notes,
      measurements: {
        estimatedDepthCm: depthCm,
        estimatedWidthCm: widthCm,
        estimatedLengthCm: lengthCm,
      },
    };
    storage.saveIssue(updated);
    onIssueUpdated(updated);
    setIsSaving(false);
    setStatusMessage('Inspection checklist and notes saved.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        eyebrow={
          <>
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            Field task
          </>
        }
        icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
        title={activeIssue.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-amber-400">{activeIssue.referenceNumber}</span>
            <StatusBadge status={activeIssue.status} />
          </span>
        }
        actions={
          <>
            {onClose && (
              <button type="button" onClick={onClose} className="rg-btn rg-btn-ghost" aria-label="Back to task list">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${activeIssue.location.lat},${activeIssue.location.lng}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="rg-btn rg-btn-secondary"
            >
              <Navigation className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              Turn-by-turn GPS
            </button>
          </>
        }
      />

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Task Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Evidence & AI Detection (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Photographic / video Evidence */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="relative flex items-center justify-center p-1.5">
              <DetectionMedia
                imageSrc={activeIssue.evidenceImageUrl}
                videoSrc={activeIssue.evidenceVideoUrl}
                detection={activeIssue.detectionData}
                alt={`Road evidence for ${activeIssue.referenceNumber}`}
                caption={activeIssue.location.street || activeIssue.location.area}
                maxHeightClassName="max-h-[280px]"
                allowFullView
              />
              <div className="absolute top-2 right-2 bg-slate-900/90 text-amber-400 text-[11px] font-mono px-2 py-0.5 rounded border border-slate-700">
                Severity: {activeIssue.severity}
              </div>
            </div>
          </div>

          {/* AI Detection Summary */}
          {activeIssue.detectionData && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                AI Surface Assessment
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Detected Cavities</span>
                  <span className="text-slate-100 font-mono font-bold">
                    {activeIssue.detectionData.potholeCount}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Model Confidence</span>
                  <span className="text-slate-100 font-mono font-bold">
                    {Math.round(activeIssue.detectionData.confidence * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                Guidance: {activeIssue.detectionData.recommendedAction || 'Cold-mix remediation'}
              </p>
            </div>
          )}

          {/* Location Details */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Site Location
            </h4>
            <p className="text-xs text-slate-300 font-medium">
              {activeIssue.location.street || 'Carriageway'}, {activeIssue.location.area}
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              {activeIssue.location.lat.toFixed(4)}°N, {activeIssue.location.lng.toFixed(4)}°E · {activeIssue.location.city}
            </p>
          </div>
        </div>

        {/* Right Column: Inspection Checklist & Remediation Actions (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Status Advancement Controls (Requirement 14) */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Field Status Workflow
              </span>
              <span className="text-xs text-amber-400 font-mono">
                Current: {activeIssue.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleUpdateStatus('inspection_scheduled')}
                aria-pressed={activeIssue.status === 'inspection_scheduled'}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                  activeIssue.status === 'inspection_scheduled'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Mark inspected
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus('in_repair')}
                aria-pressed={activeIssue.status === 'in_repair'}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                  activeIssue.status === 'in_repair'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Patch in progress
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus('resolved')}
                aria-pressed={activeIssue.status === 'resolved'}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                  activeIssue.status === 'resolved'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Certify resolved
              </button>
            </div>
          </div>

          {/* Field inspection checklist */}
          <div className="rg-panel space-y-3 rounded-xl p-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
              <CheckSquare className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Standard field inspection checklist
            </h3>

            <div className="space-y-2 text-xs">
              {(
                [
                  ['trafficSafetyConePlaced', 'Traffic safety cones & warning triangle placed upstream'],
                  ['depthMeasured', 'Depth and perimeter measured with gauge'],
                  ['pavementCrackingAssessed', 'Sub-base checked for water seepage or alligator cracking'],
                  ['asphaltBatchRequested', 'Bituminous hot/cold asphalt batch requisitioned from plant'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleChecklist(key)}
                  aria-pressed={checklist[key]}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left transition-colors hover:bg-slate-800/50"
                >
                  {checklist[key] ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  )}
                  <span className={checklist[key] ? 'text-slate-200' : 'text-slate-400'}>{label}</span>
                </button>
              ))}
            </div>

            {/* Field Measurements */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                Field Measurements
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="inspection-depth" className="mb-0.5 block text-[10px] text-slate-500">
                    Depth (cm)
                  </label>
                  <input
                    id="inspection-depth"
                    type="number"
                    value={depthCm}
                    onChange={(e) => setDepthCm(Number(e.target.value))}
                    className="rg-input !py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="inspection-width" className="mb-0.5 block text-[10px] text-slate-500">
                    Width (cm)
                  </label>
                  <input
                    id="inspection-width"
                    type="number"
                    value={widthCm}
                    onChange={(e) => setWidthCm(Number(e.target.value))}
                    className="rg-input !py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="inspection-length" className="mb-0.5 block text-[10px] text-slate-500">
                    Length (cm)
                  </label>
                  <input
                    id="inspection-length"
                    type="number"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(Number(e.target.value))}
                    className="rg-input !py-1.5 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Field Notes */}
            <div className="border-t border-slate-800 pt-2">
              <label htmlFor="inspection-notes" className="mb-1 block text-[11px] font-semibold text-slate-400">
                Technician notes &amp; observations
              </label>
              <textarea
                id="inspection-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Edges trimmed, tack coat applied, compacted with vibrating roller."
                className="rg-textarea resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={handleSaveNotes} disabled={isSaving} className="rg-btn rg-btn-primary">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save checklist &amp; notes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
