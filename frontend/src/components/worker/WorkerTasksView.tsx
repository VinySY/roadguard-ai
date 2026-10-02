import React, { useState } from 'react';
import { RoadIssue, IssueStatus, User } from '../../types';
import { storage } from '../../services/storage';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Camera,
  Save,
  CheckSquare,
  Square,
  ArrowLeft,
  Wrench,
  FileCheck,
} from 'lucide-react';

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

  if (!activeIssue) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No assigned tasks in your queue.</p>
      </div>
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
      {/* Top Header & Task Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-400">
                {activeIssue.referenceNumber}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-xs text-slate-400 capitalize">
                Status: {activeIssue.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100">{activeIssue.title}</h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${activeIssue.location.lat},${activeIssue.location.lng}`;
              window.open(url, '_blank');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
            <span>Turn-by-Turn GPS</span>
          </button>
        </div>
      </div>

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
          {/* Photographic Evidence */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="relative aspect-video flex items-center justify-center">
              <img
                src={activeIssue.evidenceImageUrl}
                alt="Pothole Inspection"
                className="w-full h-full object-cover"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleUpdateStatus('inspection_scheduled')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  activeIssue.status === 'inspection_scheduled'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Mark Inspected
              </button>
              <button
                onClick={() => handleUpdateStatus('in_repair')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  activeIssue.status === 'in_repair'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Patch in Progress
              </button>
              <button
                onClick={() => handleUpdateStatus('resolved')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  activeIssue.status === 'resolved'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Certify Resolved
              </button>
            </div>
          </div>

          {/* Field Inspection Checklist */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>Standard Field Inspection Checklist</span>
            </h4>

            <div className="space-y-2 text-xs">
              <label
                onClick={() => toggleChecklist('trafficSafetyConePlaced')}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/50"
              >
                {checklist.trafficSafetyConePlaced ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span className={checklist.trafficSafetyConePlaced ? 'text-slate-200' : 'text-slate-400'}>
                  Traffic safety cones & warning triangle placed upstream
                </span>
              </label>

              <label
                onClick={() => toggleChecklist('depthMeasured')}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/50"
              >
                {checklist.depthMeasured ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span className={checklist.depthMeasured ? 'text-slate-200' : 'text-slate-400'}>
                  Depth and perimeter measured with gauge
                </span>
              </label>

              <label
                onClick={() => toggleChecklist('pavementCrackingAssessed')}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/50"
              >
                {checklist.pavementCrackingAssessed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span className={checklist.pavementCrackingAssessed ? 'text-slate-200' : 'text-slate-400'}>
                  Sub-base checked for water seepage or alligator cracking
                </span>
              </label>

              <label
                onClick={() => toggleChecklist('asphaltBatchRequested')}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/50"
              >
                {checklist.asphaltBatchRequested ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span className={checklist.asphaltBatchRequested ? 'text-slate-200' : 'text-slate-400'}>
                  Bituminous hot/cold asphalt batch requisitioned from plant
                </span>
              </label>
            </div>

            {/* Field Measurements */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                Field Measurements
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Depth (cm)</label>
                  <input
                    type="number"
                    value={depthCm}
                    onChange={(e) => setDepthCm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Width (cm)</label>
                  <input
                    type="number"
                    value={widthCm}
                    onChange={(e) => setWidthCm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Length (cm)</label>
                  <input
                    type="number"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Field Notes */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Technician Notes & Observations
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Edges trimmed, tack coat applied, compacted with vibrating roller."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Checklist & Notes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
