import React, { useState } from 'react';
import { RoadIssue, Municipality } from '../../types';
import { storage } from '../../services/storage';
import { sendMunicipalEmailDispatch, DispatchReceipt } from '../../services/municipality';
import { X, Mail, Building2, Send, CheckCircle2, ShieldCheck, Settings2, Loader2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Municipal Dispatch Gateway</h3>
              <p className="text-xs text-slate-400">Formal Pothole & Road Hazard Transmittal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {receipt ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-100">Transmittal Complete</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Municipal dispatch packet successfully delivered to{' '}
                  <span className="text-slate-200 font-medium">{receipt.dispatchedTo.municipalityName}</span>.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-1.5 max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Reference:</span>
                  <span className="text-amber-400 font-semibold">{receipt.referenceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Email:</span>
                  <span className="text-slate-300">{receipt.dispatchedTo.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Response Target:</span>
                  <span className="text-slate-300">{receipt.dispatchedTo.slaHours}h SLA</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic max-w-xs mx-auto">
                {receipt.demoNotice}
              </p>

              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Target Municipality Selector */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">
                  Select Responsible Municipal Authority
                </label>
                <select
                  value={selectedMuniId}
                  onChange={(e) => setSelectedMuniId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.dispatchZone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email Transmittal Preview */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-mono text-[11px] text-slate-400">
                  <span>TO: {currentMuni.contactEmail}</span>
                  <span className="text-amber-400 font-semibold">{issue.referenceNumber}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 block">Subject:</span>
                  <p className="text-slate-200 font-medium">
                    [URGENT ROAD REPAIR] {issue.title} — {issue.location.street || issue.location.area}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Location</span>
                    <span className="text-slate-200 font-medium">
                      {issue.location.street || 'Site roadway'}, {issue.location.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Severity</span>
                    <span className="text-amber-400 font-semibold capitalize">
                      {issue.severity} Severity
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Detected Cavities</span>
                    <span className="text-slate-200 font-mono">
                      {issue.detectionData?.potholeCount || 1} Pothole(s)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Reported By</span>
                    <span className="text-slate-200">{issue.reportedBy.name || 'Local Citizen'}</span>
                  </div>
                </div>

                {issue.evidenceImageUrl && (
                  <div>
                    <span className="text-slate-400 text-[11px] block mb-1">Attached Photographic Evidence:</span>
                    <img
                      src={issue.evidenceImageUrl}
                      alt="Evidence"
                      className="w-full h-32 object-cover rounded-lg border border-slate-800"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendDispatch}
                  disabled={isSending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Municipal Transmittal</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
