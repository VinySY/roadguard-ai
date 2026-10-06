import React, { useState } from 'react';
import { RoadIssue } from '../../types';
import { FileText, Printer, Download, MapPin, Building2, CheckCircle2 } from 'lucide-react';

interface InspectorReportsProps {
  issues: RoadIssue[];
}

export const InspectorReports: React.FC<InspectorReportsProps> = ({ issues }) => {
  const [reportType, setReportType] = useState<'all' | 'critical' | 'resolved'>('all');

  const filtered = issues.filter((i) => {
    if (reportType === 'critical') return i.severity === 'critical' || i.severity === 'high';
    if (reportType === 'resolved') return i.status === 'resolved';
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Municipal Pavement Audit Reports</h2>
          <p className="text-xs text-slate-400 mt-1">
            Formal transmittable incident summaries for municipal engineering reviews and public works audits.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl w-full sm:w-fit overflow-x-auto text-nowrap">
        <button
          onClick={() => setReportType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === 'all'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Municipal Defects ({issues.length})
        </button>
        <button
          onClick={() => setReportType('critical')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === 'critical'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Urgent Hazard Log
        </button>
        <button
          onClick={() => setReportType('resolved')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === 'resolved'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Remediated & Certified Log
        </button>
      </div>

      {/* Formal Printable Document View */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-sm">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 text-xs gap-3">
          <div>
            <span className="text-[10px] font-mono text-amber-400 tracking-wider uppercase">
              Official Municipal Document
            </span>
            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              Pavement Defect & Remediation Transmittal Audit
            </h3>
            <span className="text-slate-400">Date Generated: {new Date().toLocaleDateString()}</span>
          </div>

          <div className="text-right font-mono text-slate-400">
            <div>Jurisdiction: Chandigarh Tri-City Urban Zone</div>
            <div className="text-emerald-400 font-semibold">Authorized Sign-off: Divya Singhal, P.E.</div>
          </div>
        </div>

        {/* Audit Rows */}
        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {item.referenceNumber}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="capitalize font-semibold text-amber-400">{item.severity}</span>
                  <span className="text-slate-500">·</span>
                  <span className="capitalize text-slate-300 font-mono">
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Location</span>
                  <span className="text-slate-300 font-medium">
                    {item.location.street || item.location.area}, {item.location.city}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Responsible Municipality</span>
                  <span className="text-slate-300">{item.municipalityName}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Assigned Crew / Technician</span>
                  <span className="text-slate-300">{item.assignedWorkerName || 'Unassigned'}</span>
                </div>
              </div>

              {item.inspection && (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
                  Field Log: {item.inspection.notes || 'Inspection completed.'} · Measurements: Depth{' '}
                  {item.inspection.measurements?.estimatedDepthCm || 'N/A'}cm
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
