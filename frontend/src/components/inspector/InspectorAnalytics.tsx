import React from 'react';
import { RoadIssue } from '../../types';
import { BarChart3, TrendingUp, ShieldAlert, CheckCircle2, Clock, MapPin } from 'lucide-react';

interface InspectorAnalyticsProps {
  issues: RoadIssue[];
}

export const InspectorAnalytics: React.FC<InspectorAnalyticsProps> = ({ issues }) => {
  const total = issues.length;
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;

  const resolved = issues.filter((i) => i.status === 'resolved').length;
  const inRepair = issues.filter((i) => i.status === 'in_repair').length;
  const inspectionBacklog = issues.filter(
    (i) => i.status === 'reported' || i.status === 'notified_municipality'
  ).length;

  // Sector / Zone breakdown
  const zoneCounts: Record<string, number> = {};
  issues.forEach((i) => {
    const area = i.location.area || 'Central Sector';
    zoneCounts[area] = (zoneCounts[area] || 0) + 1;
  });

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100">Municipal Pavement Analytics</h2>
        <p className="text-xs text-slate-400 mt-1">
          Quantitative telemetry on road distress density, resolution velocity, and municipal backlog.
        </p>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Municipal Resolution Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {total > 0 ? Math.round((resolved / total) * 100) : 100}%
            </span>
            <span className="text-[11px] text-slate-500 font-sans">
              ({resolved} of {total} certified)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Inspection Backlog</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {inspectionBacklog}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">awaiting crew dispatch</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Average Response SLA</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-400 tabular-nums">
              18.4h
            </span>
            <span className="text-[11px] text-slate-500 font-sans">against 24h municipal target</span>
          </div>
        </div>
      </div>

      {/* Severity Distribution & Zone Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Breakdown Bar Representation */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Severity Distribution</h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-rose-400 font-medium">Critical</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {criticalCount} ({total > 0 ? Math.round((criticalCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-full"
                  style={{ width: `${total > 0 ? (criticalCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-amber-400 font-medium">High</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {highCount} ({total > 0 ? Math.round((highCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${total > 0 ? (highCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-blue-400 font-medium">Medium</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {mediumCount} ({total > 0 ? Math.round((mediumCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${total > 0 ? (mediumCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-emerald-400 font-medium">Low</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {lowCount} ({total > 0 ? Math.round((lowCount / total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${total > 0 ? (lowCount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Geographic Concentration */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Geographic Defect Concentration</h3>

          <div className="space-y-2.5">
            {Object.entries(zoneCounts).map(([zone, count]) => (
              <div
                key={zone}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-200 font-medium">{zone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono tabular-nums">
                    {count} incident{count === 1 ? '' : 's'}
                  </span>
                  <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: `${(count / total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
