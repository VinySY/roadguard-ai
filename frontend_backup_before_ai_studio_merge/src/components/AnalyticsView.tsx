import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Layers, 
  PieChart, 
  Calendar, 
  ArrowRight,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Target,
  FileText
} from 'lucide-react';
import { DetectionResult, NavigationTab, AnalyticsSummaryResponse } from '../types/detection';
import { fetchAnalyticsSummary } from '../services/api';

interface AnalyticsViewProps {
  latestResult: DetectionResult | null;
  onNavigate: (tab: NavigationTab) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  latestResult,
  onNavigate,
}) => {
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAnalyticsSummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load analytics summary:', err);
      setError(err.message || 'Failed to fetch historical analytics from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // Active session metrics
  const hasResult = Boolean(latestResult && latestResult.predictions && latestResult.predictions.length > 0);
  const activeCount = latestResult?.predictions.length || 0;
  const activeAvgConfidence = hasResult
    ? (latestResult!.predictions.reduce((acc, p) => acc + p.confidence, 0) / activeCount) * 100
    : 0;

  const activeSeverityCounts = {
    critical: latestResult?.predictions.filter(p => p.severity === 'critical').length || 0,
    high: latestResult?.predictions.filter(p => p.severity === 'high').length || 0,
    moderate: latestResult?.predictions.filter(p => p.severity === 'moderate').length || 0,
    minor: latestResult?.predictions.filter(p => p.severity === 'minor').length || 0,
  };

  const totalHistoricalDetections = summary 
    ? (summary.severityDistribution.critical + summary.severityDistribution.high + summary.severityDistribution.moderate + summary.severityDistribution.minor)
    : 0;

  const totalHistoricalRisks = summary
    ? (summary.riskDistribution.CRITICAL + summary.riskDistribution.HIGH + summary.riskDistribution.MEDIUM + summary.riskDistribution.LOW)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              MUNICIPAL ASSET ANALYTICS
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              MYSQL HISTORICAL TELEMETRY
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            <span>Road Condition &amp; Degradation Analytics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Defect density distributions, seasonal deterioration curves, repair resolution rates, and automated inspection metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Recalculate metrics from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Analytics</span>
          </button>

          <button
            onClick={() => onNavigate('detect')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm shadow-amber-500/20 cursor-pointer"
          >
            <span>Run New Scan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !summary && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Calculating historical municipal aggregates from MySQL...</p>
        </div>
      )}

      {/* Error State */}
      {error && !summary && (
        <div className="bg-slate-900/60 border border-red-500/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <h3 className="text-base font-bold text-white">Failed to Load Database Analytics</h3>
          <p className="text-xs text-slate-400 max-w-md font-mono">{error}</p>
          <button
            onClick={loadAnalytics}
            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Retry Aggregation
          </button>
        </div>
      )}

      {/* Real Historical KPI Metric Banners */}
      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
            {/* Total Inspections */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-500 text-[10px] uppercase block">TOTAL INSPECTIONS</span>
              <div className="text-2xl font-black text-white mt-1">
                {summary.totals.totalInspections}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Recorded scans in DB</span>
            </div>

            {/* Unique Potholes */}
            <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-xl">
              <span className="text-amber-400 font-bold text-[10px] uppercase block">UNIQUE POTHOLES</span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {summary.totals.totalUniquePotholes}
              </div>
              <span className="text-[10px] text-amber-300/80 block mt-0.5">Deduplicated defects</span>
            </div>

            {/* Total Raw Detections */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-500 text-[10px] uppercase block">RAW DETECTIONS</span>
              <div className="text-2xl font-black text-white mt-1">
                {summary.totals.totalDetections}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Across all image/video frames</span>
            </div>

            {/* Avg Damage % */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-500 text-[10px] uppercase block">AVG SURFACE DAMAGE</span>
              <div className="text-2xl font-black text-white mt-1">
                {summary.totals.avgDamagePercentage}%
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Mean cavity area ratio</span>
            </div>

            {/* Citizen Complaints */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-slate-500 text-[10px] uppercase block">CITIZEN COMPLAINTS</span>
              <div className="text-2xl font-black text-white mt-1">
                {summary.totals.totalRoadIssues}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Filed work orders</span>
            </div>

            {/* Repair Resolution Rate */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
              <span className="text-emerald-400 font-bold text-[10px] uppercase block">RESOLUTION RATE</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {summary.totals.resolutionRate}%
              </div>
              <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                {summary.totals.resolvedRoadIssues} of {summary.totals.totalRoadIssues} resolved
              </span>
            </div>
          </div>

          {/* Main Visualizations Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* 1. Monthly Inspection & Pothole Trend Chart */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span>Monthly Defect &amp; Inspection Volume Trends</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    HISTORICAL
                  </span>
                </div>

                {summary.monthlyTrends.length > 0 ? (
                  <div className="space-y-4 pt-3">
                    {summary.monthlyTrends.map((trend) => {
                      const maxInsp = Math.max(...summary.monthlyTrends.map(t => t.inspections), 1);
                      const maxDet = Math.max(...summary.monthlyTrends.map(t => t.detections), 1);

                      return (
                        <div key={trend.month} className="space-y-1.5 font-mono text-xs">
                          <div className="flex justify-between items-center text-slate-300 font-bold">
                            <span>{trend.month}</span>
                            <span className="text-[11px] text-slate-400">
                              {trend.inspections} Scans · <strong className="text-amber-400">{trend.detections} Defect Hits</strong>
                            </span>
                          </div>

                          {/* Dual comparison bar */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-500 w-16">INSPECTIONS</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
                                <div 
                                  className="h-full bg-sky-500 rounded-full transition-all"
                                  style={{ width: `${(trend.inspections / maxInsp) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 w-6 text-right">{trend.inspections}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-amber-400/80 w-16">DETECTIONS</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
                                <div 
                                  className="h-full bg-amber-500 rounded-full transition-all shadow-[0_0_8px_#f59e0b80]"
                                  style={{ width: `${(trend.detections / maxDet) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-amber-400 w-6 text-right font-bold">{trend.detections}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No multi-month historical scans recorded yet.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between">
                <span>Aggregated by calendar month</span>
                <span>Direct MySQL temporal query</span>
              </div>
            </div>

            {/* 2. Hazard Severity & Risk Tier Distribution */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-amber-400" />
                    <span>Hazard Severity &amp; Risk Tier Distribution</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    CLASSIFICATION
                  </span>
                </div>

                {/* Severity Breakdown Bars */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-mono font-semibold text-slate-300 block">
                    Individual Cavity Severity ({totalHistoricalDetections} Total):
                  </span>
                  {[
                    { label: 'Critical Severity (>12% Area / High Conf)', count: summary.severityDistribution.critical, color: 'bg-red-500', text: 'text-red-400' },
                    { label: 'High Severity (6-12% Area)', count: summary.severityDistribution.high, color: 'bg-orange-500', text: 'text-orange-400' },
                    { label: 'Moderate Severity (2-6% Area)', count: summary.severityDistribution.moderate, color: 'bg-amber-500', text: 'text-amber-400' },
                    { label: 'Minor Severity (<2% Area)', count: summary.severityDistribution.minor, color: 'bg-emerald-500', text: 'text-emerald-400' },
                  ].map((row) => {
                    const pct = totalHistoricalDetections > 0 
                      ? ((row.count / totalHistoricalDetections) * 100).toFixed(1)
                      : '0.0';

                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-slate-400">{row.label}</span>
                          <span className={`font-bold ${row.text}`}>
                            {row.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                          <div
                            className={`h-full ${row.color} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Risk Level Tier Grid */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-mono font-semibold text-slate-300 block">
                    Inspection Overall Risk Tier Breakdown:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-red-500/30 text-center">
                      <span className="text-[10px] text-red-400 block">CRITICAL</span>
                      <span className="text-lg font-bold text-white">{summary.riskDistribution.CRITICAL}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-orange-500/30 text-center">
                      <span className="text-[10px] text-orange-400 block">HIGH</span>
                      <span className="text-lg font-bold text-white">{summary.riskDistribution.HIGH}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-amber-500/30 text-center">
                      <span className="text-[10px] text-amber-400 block">MEDIUM</span>
                      <span className="text-lg font-bold text-white">{summary.riskDistribution.MEDIUM}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-emerald-500/30 text-center">
                      <span className="text-[10px] text-emerald-400 block">LOW</span>
                      <span className="text-lg font-bold text-white">{summary.riskDistribution.LOW}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500">
                Calculated from all persisted YOLOv11 detections
              </div>
            </div>

            {/* 3. Road Issue Lifecycle & Work Order Resolution Funnel */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>Citizen Work Order Resolution Lifecycle</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {summary.totals.resolutionRate}% RESOLVED
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    { label: '1. Reported (Awaiting Triage)', count: summary.issueStatusDistribution['Reported'], color: 'bg-slate-500', badge: 'bg-slate-800 text-slate-300' },
                    { label: '2. In Inspection (Crew Dispatched)', count: summary.issueStatusDistribution['In Inspection'], color: 'bg-sky-500', badge: 'bg-sky-500/20 text-sky-400' },
                    { label: '3. Scheduled for Repair (Contractor Assigned)', count: summary.issueStatusDistribution['Scheduled for Repair'], color: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-400' },
                    { label: '4. Resolved (Road Restored)', count: summary.issueStatusDistribution['Resolved'], color: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400' },
                  ].map((step) => {
                    const total = summary.totals.totalRoadIssues || 1;
                    const pct = ((step.count / total) * 100).toFixed(0);

                    return (
                      <div key={step.label} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-semibold">{step.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${step.badge}`}>
                            {step.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                          <div 
                            className={`h-full ${step.color} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between">
                <span>Municipal SLA Tracking</span>
                <button
                  onClick={() => onNavigate('issues')}
                  className="text-amber-400 hover:underline cursor-pointer"
                >
                  Manage Road Issues &rarr;
                </button>
              </div>
            </div>

            {/* 4. Active Session Scan Telemetry Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span>Active Session Inspection Telemetry</span>
                  </h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    hasResult ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {hasResult ? 'LIVE SCAN LOADED' : 'AWAITING SCAN'}
                  </span>
                </div>

                {hasResult && latestResult ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Cavities</span>
                        <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                          {activeCount}
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Avg Conf</span>
                        <div className="text-xl font-black text-white font-mono mt-0.5">
                          {activeAvgConfidence.toFixed(0)}%
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Risk Tier</span>
                        <div className="text-xl font-black text-orange-400 font-mono mt-0.5">
                          {latestResult.analytics?.overallRiskLevel || 'HIGH'}
                        </div>
                      </div>
                    </div>

                    {/* Active Scan Severity Breakdown */}
                    <div className="space-y-2">
                      <span className="text-xs font-mono text-slate-400">Current Image Severities:</span>
                      {[
                        { label: 'Critical Severity', count: activeSeverityCounts.critical, color: 'bg-red-500' },
                        { label: 'High Severity', count: activeSeverityCounts.high, color: 'bg-orange-500' },
                        { label: 'Moderate Severity', count: activeSeverityCounts.moderate, color: 'bg-amber-500' },
                        { label: 'Minor Severity', count: activeSeverityCounts.minor, color: 'bg-emerald-500' },
                      ].map((row) => (
                        <div key={row.label} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-slate-400">{row.label}</span>
                            <span className="text-slate-200 font-bold">{row.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                            <div
                              className={`h-full ${row.color} rounded-full transition-all`}
                              style={{ width: activeCount > 0 ? `${(row.count / activeCount) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      No active scan in current browser session. Run an AI inspection in Detection Studio to populate live session comparison telemetry.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={() => onNavigate('detect')}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{hasResult ? 'Inspect in Studio' : 'Run First Image Scan'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
