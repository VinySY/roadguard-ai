import React from 'react';
import { RoadIssue, LocationCoordinates, User } from '../../types';
import { LeafletMap } from '../map/LeafletMap';
import {
  ShieldAlert,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Wrench,
  ArrowRight,
  UserCheck,
  Building2,
  TrendingUp,
  MapPin,
} from 'lucide-react';

interface InspectorOverviewProps {
  currentUser: User;
  issues: RoadIssue[];
  userLocation: LocationCoordinates | null;
  onOpenIssue: (issue: RoadIssue) => void;
  onNavigateToMap: () => void;
  onNavigateToAssignments: () => void;
  onNavigateToReports: () => void;
  onLocationUpdate?: (coords: LocationCoordinates) => void;
}

export const InspectorOverview: React.FC<InspectorOverviewProps> = ({
  currentUser,
  issues,
  userLocation,
  onOpenIssue,
  onNavigateToMap,
  onNavigateToAssignments,
  onNavigateToReports,
  onLocationUpdate,
}) => {
  const totalReports = issues.length;
  const awaitingInspection = issues.filter(
    (i) => i.status === 'reported' || i.status === 'notified_municipality'
  ).length;
  const underRepair = issues.filter(
    (i) => i.status === 'inspection_scheduled' || i.status === 'in_repair'
  ).length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length;

  const criticalIssues = issues.filter(
    (i) => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved'
  );

  const unassignedCount = issues.filter((i) => !i.assignedWorkerId && i.status !== 'resolved').length;

  // Recent municipal activity
  const recentTimeline = issues
    .flatMap((issue) =>
      issue.timeline.map((event) => ({
        ...event,
        issueRef: issue.referenceNumber,
        issueTitle: issue.title,
        issue,
      }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);

  return (
    <div className="space-y-6 w-full">
      {/* Inspector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-slate-400 font-mono">
              Municipal Engineering & Quality Control Division
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-100">
            Municipal Pavement Operations — {currentUser.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Jurisdiction: <span className="text-amber-400 font-medium">{currentUser.assignedZone || 'All Sectors'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onNavigateToAssignments}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Crew Assignments ({unassignedCount})</span>
          </button>
          <button
            onClick={onNavigateToReports}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm"
          >
            <span>Executive Reports</span>
          </button>
        </div>
      </div>

      {/* 1. Meaningful Municipal-Level Statistics (Requirement 17) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Total Road Reports</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {totalReports}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">across all zones</span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Awaiting Inspection</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {awaitingInspection}
          </span>
          <span className="text-[10px] text-amber-500/80 block mt-0.5">pending site visit</span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Under Active Repair</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-blue-400 tabular-nums">
            {underRepair}
          </span>
          <span className="text-[10px] text-blue-400/80 block mt-0.5">crews dispatched</span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-0.5">Remediated & Certified</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {resolvedCount}
          </span>
          <span className="text-[10px] text-emerald-500/80 block mt-0.5">
            {totalReports > 0 ? Math.round((resolvedCount / totalReports) * 100) : 100}% resolution rate
          </span>
        </div>
      </div>

      {/* 2. Interactive Municipal Map Overview */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Municipal Road Situation Map</span>
            <span className="text-xs text-slate-400 font-normal">· Real-time incident density & status</span>
          </h3>
          <button
            onClick={onNavigateToMap}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium"
          >
            Open Full Map Console &rarr;
          </button>
        </div>

        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-sm">
          <LeafletMap
            issues={issues}
            role="inspector"
            userLocation={userLocation}
            onLocationUpdate={onLocationUpdate}
            onSelectIssue={onOpenIssue}
            height="300px"
          />
        </div>
      </div>

      {/* 3. Needs Attention & Recent Activity (Requirement 17) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Needs Attention Column (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Needs Supervisor Attention ({criticalIssues.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Critical & High Priority</span>
          </div>

          <div className="space-y-3">
            {criticalIssues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => onOpenIssue(issue)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-850 active:bg-slate-800 active:scale-[0.995] transition-all cursor-pointer space-y-3 shadow-sm group select-none"
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
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${
                        issue.severity === 'critical'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <span className="text-slate-600">·</span>
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

                {/* Tertiary Info: SLA & Action */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-800/80 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span>SLA Target: 24h</span>
                    <span className="text-slate-600">·</span>
                    <span className="capitalize text-slate-400">{issue.status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-amber-400 font-medium text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Manage Incident</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Municipal Activity Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Recent Municipal Activity</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            {recentTimeline.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onOpenIssue(item.issue)}
                className="flex items-start gap-3 cursor-pointer hover:bg-slate-800/40 p-1.5 rounded-lg transition-colors group"
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{item.issueRef}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                  <span className="text-[10px] font-mono text-slate-500 block">
                    {item.timestamp} · {item.actor || 'Municipal System'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
