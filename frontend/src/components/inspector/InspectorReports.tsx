import React, { useState } from 'react';
import { RoadIssue } from '../../types';
import { FileText, Printer, Building2 } from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { SeverityBadge, StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';

interface InspectorReportsProps {
  issues: RoadIssue[];
}

type ReportType = 'all' | 'critical' | 'resolved';

export const InspectorReports: React.FC<InspectorReportsProps> = ({ issues }) => {
  const [reportType, setReportType] = useState<ReportType>('all');

  const filtered = issues.filter((i) => {
    if (reportType === 'critical') return i.severity === 'critical' || i.severity === 'high';
    if (reportType === 'resolved') return i.status === 'resolved';
    return true;
  });

  // Jurisdiction summary comes from the actual report data, not a fixed city string.
  const municipalities = Array.from(
    new Set(issues.map((i) => i.municipalityName).filter((name): name is string => Boolean(name)))
  );

  const tabs: { id: ReportType; label: string; count: number }[] = [
    { id: 'all', label: 'All municipal defects', count: issues.length },
    {
      id: 'critical',
      label: 'Urgent hazard log',
      count: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
    },
    {
      id: 'resolved',
      label: 'Remediated & certified',
      count: issues.filter((i) => i.status === 'resolved').length,
    },
  ];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow={
          <>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Municipal audit reporting
          </>
        }
        icon={<FileText className="h-4 w-4" aria-hidden="true" />}
        title="Pavement audit reports"
        description="Formal transmittable incident summaries for municipal engineering reviews and public works audits."
        actions={
          <button type="button" onClick={() => window.print()} className="rg-btn rg-btn-secondary">
            <Printer className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            Print / save PDF
          </button>
        }
      />

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Report filter"
        className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 p-1 text-nowrap sm:w-fit"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={reportType === tab.id}
            onClick={() => setReportType(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              reportType === tab.id
                ? 'bg-amber-500 font-semibold text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Printable document */}
      <div className="rg-panel space-y-6 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-700/50 pb-4 text-xs sm:flex-row sm:items-center">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
              Municipal document
            </span>
            <h2 className="mt-0.5 text-base font-bold text-slate-100">
              Pavement defect &amp; remediation transmittal audit
            </h2>
            <span className="text-slate-400">Generated {new Date().toLocaleDateString()}</span>
          </div>

          <div className="font-mono text-slate-400 sm:text-right">
            <div>
              Jurisdiction:{' '}
              <span className="text-slate-200">
                {municipalities.length > 0 ? municipalities.join(', ') : 'Not specified'}
              </span>
            </div>
            <div className="text-emerald-400">
              {filtered.length} record{filtered.length === 1 ? '' : 's'} in this report
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No records match this report"
            description="Change the report filter or add road reports to build the audit log."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{item.referenceNumber}</span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={item.severity} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="mb-0.5 block text-[11px] text-slate-500">Location</span>
                    <span className="font-medium text-slate-300">
                      {item.location.street || item.location.area}, {item.location.city}
                    </span>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[11px] text-slate-500">Responsible municipality</span>
                    <span className="text-slate-300">{item.municipalityName || 'Not assigned'}</span>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-[11px] text-slate-500">Assigned crew / technician</span>
                    <span className="text-slate-300">{item.assignedWorkerName || 'Unassigned'}</span>
                  </div>
                </div>

                {item.inspection && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 font-mono text-[11px] text-slate-400">
                    Field log: {item.inspection.notes || 'Inspection completed.'} · Estimated depth{' '}
                    {item.inspection.measurements?.estimatedDepthCm ?? 'N/A'} cm
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
