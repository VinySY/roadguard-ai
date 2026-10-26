import React, { useEffect, useState } from 'react';
import { RoadIssue } from '../../types';
import { storage } from '../../services/storage';
import { sendMunicipalEmailDispatch, DispatchReceipt } from '../../services/municipality';
import {
  X,
  Mail,
  Building2,
  Send,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { EvidenceImage } from '../common/EvidenceImage';

interface MunicipalEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: RoadIssue;
}

export const MunicipalEmailModal: React.FC<MunicipalEmailModalProps> = ({ isOpen, onClose, issue }) => {
  const municipalities = storage.getMunicipalities();
  const [selectedMuniId, setSelectedMuniId] = useState(issue.municipalityId || municipalities[0].id);
  const [isSending, setIsSending] = useState(false);
  const [receipt, setReceipt] = useState<DispatchReceipt | null>(null);

  // Escape closes the transmittal dialog while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSending) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSending, onClose]);

  if (!isOpen) return null;

  const currentMuni = municipalities.find((m) => m.id === selectedMuniId) || municipalities[0];

  const handleSendDispatch = async () => {
    setIsSending(true);
    const res = await sendMunicipalEmailDispatch(issue, currentMuni);
    setIsSending(false);
    setReceipt(res);

    // Update status to notified_municipality if it was merely reported
    if (issue.status === 'reported') {
      storage.updateIssueStatus(
        issue.id,
        'notified_municipality',
        'Municipal Gateway',
        `Dispatched to ${currentMuni.name}`
      );
    }
  };

  return (
    <div className="rg-animate-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="municipal-dispatch-title"
        aria-describedby="municipal-dispatch-description"
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="municipal-dispatch-title" className="text-sm font-semibold text-slate-100">
                Municipal dispatch gateway
              </h3>
              <p id="municipal-dispatch-description" className="text-xs text-slate-400">
                Formal pothole &amp; road hazard transmittal
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rg-icon-btn" aria-label="Close dispatch dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5 sm:p-6">
          {receipt ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-100">Transmittal complete</h4>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
                  Municipal dispatch packet delivered to{' '}
                  <span className="font-medium text-slate-200">
                    {receipt.dispatchedTo.municipalityName}
                  </span>
                  .
                </p>
              </div>

              <dl className="mx-auto max-w-md space-y-1.5 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left font-mono text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Reference</dt>
                  <dd className="font-semibold text-amber-400">{receipt.referenceNumber}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Department</dt>
                  <dd className="truncate text-slate-300">{receipt.dispatchedTo.department}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Recipient email</dt>
                  <dd className="truncate text-slate-300">{receipt.dispatchedTo.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Response target</dt>
                  <dd className="text-slate-300">{receipt.dispatchedTo.slaHours}h SLA</dd>
                </div>
              </dl>

              <p className="mx-auto max-w-xs text-[11px] italic leading-relaxed text-slate-500">
                {receipt.demoNotice}
              </p>

              <button type="button" onClick={onClose} className="rg-btn rg-btn-secondary">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Target municipality selector */}
              <div>
                <label
                  htmlFor="municipal-authority-select"
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  Responsible municipal authority
                </label>
                <select
                  id="municipal-authority-select"
                  value={selectedMuniId}
                  onChange={(e) => setSelectedMuniId(e.target.value)}
                  className="rg-select"
                >
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.dispatchZone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email transmittal preview */}
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 font-mono text-[11px] text-slate-400">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">TO: {currentMuni.contactEmail}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-amber-400">{issue.referenceNumber}</span>
                </div>

                <div className="space-y-1">
                  <span className="block text-[11px] text-slate-400">Subject</span>
                  <p className="font-medium leading-relaxed text-slate-200">
                    [URGENT ROAD REPAIR] {issue.title} —{' '}
                    {issue.location.street || issue.location.area}
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800/80 bg-slate-900 p-2.5 sm:grid-cols-2">
                  <div>
                    <dt className="block text-[11px] text-slate-400">Location</dt>
                    <dd className="font-medium text-slate-200">
                      {issue.location.street || 'Site roadway'}, {issue.location.city}
                    </dd>
                  </div>
                  <div>
                    <dt className="block text-[11px] text-slate-400">Severity</dt>
                    <dd className="font-semibold capitalize text-amber-400">
                      {issue.severity} severity
                    </dd>
                  </div>
                  <div>
                    <dt className="block text-[11px] text-slate-400">Detected cavities</dt>
                    <dd className="font-mono text-slate-200">
                      {issue.detectionData?.potholeCount ?? 1} pothole
                      {(issue.detectionData?.potholeCount ?? 1) === 1 ? '' : 's'}
                    </dd>
                  </div>
                  <div>
                    <dt className="block text-[11px] text-slate-400">Reported by</dt>
                    <dd className="text-slate-200">{issue.reportedBy.name || 'Local citizen'}</dd>
                  </div>
                </dl>

                {issue.evidenceImageUrl && (
                  <div>
                    <span className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Paperclip className="h-3 w-3" aria-hidden="true" />
                      Attached photographic evidence
                    </span>
                    <EvidenceImage
                      src={issue.evidenceImageUrl}
                      alt={`Pothole evidence for ${issue.referenceNumber}`}
                      className="h-32 w-full rounded-lg border border-slate-800"
                      imgClassName="h-full w-full object-cover"
                      allowFullView
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Demo municipal gateway
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="rg-btn rg-btn-ghost">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendDispatch}
                    disabled={isSending}
                    className="rg-btn rg-btn-primary"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        <span>Send transmittal</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
