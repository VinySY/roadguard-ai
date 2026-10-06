import React from 'react';
import { RoadIssue, LocationCoordinates, User } from '../../types';
import { Plus, MapPin, ArrowRight, Clock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { LeafletMap } from '../map/LeafletMap';
import { EvidenceInputGrid, EvidenceMethod } from '../detection/EvidenceInputGrid';

interface CustomerDashboardProps {
  currentUser: User | null;
  issues: RoadIssue[];
  userLocation: LocationCoordinates | null;
  onOpenReportModal: (mode?: 'upload-image' | 'take-photo' | 'upload-video' | 'record-video') => void;
  onOpenIssueDetails: (issue: RoadIssue) => void;
  onNavigateToMap: () => void;
  onNavigateToMyReports: () => void;
  onNavigateToDetection?: (mode?: 'upload-image' | 'take-photo' | 'upload-video' | 'record-video') => void;
  onLocationUpdate?: (coords: LocationCoordinates) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  currentUser,
  issues,
  userLocation,
  onOpenReportModal,
  onOpenIssueDetails,
  onNavigateToMap,
  onNavigateToMyReports,
  onNavigateToDetection,
  onLocationUpdate,
}) => {
  // Filter personal reports submitted by current citizen (or guest submissions)
  const myReports = issues.filter(
    (i) =>
      i.reportedBy.userId === currentUser?.id ||
      (!currentUser && i.reportedBy.isGuest) ||
      i.reportedBy.name === currentUser?.name
  );

  const stats = {
    submitted: myReports.length,
    underInspection: myReports.filter(
      (i) => i.status === 'inspection_scheduled' || i.status === 'notified_municipality' || i.status === 'in_repair'
    ).length,
    resolved: myReports.filter((i) => i.status === 'resolved').length,
  };

  const recentReports = myReports.slice(0, 3);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Primary Reporting Hero Card with All 4 Input Options */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Citizen Road Reporting</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight text-balance">
            Report a Road Problem
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            Choose how you want to provide evidence. Take a photo, upload an image, record a video, or upload dashcam footage. RoadGuard AI will automatically detect potholes and notify the municipality.
          </p>

          {/* All 4 Input Action Options: Clean 2x2 Grid on Mobile, 4-Across on Desktop */}
          <div className="pt-2 w-full">
            <EvidenceInputGrid
              isActionOnly={true}
              onSelectMethod={(method) => onOpenReportModal(method)}
            />
          </div>

          {/* Quick link to Detection Studio */}
          {onNavigateToDetection && (
            <div className="pt-1">
              <button
                onClick={() => onNavigateToDetection()}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1.5"
              >
                <span>Or open full Detection Studio workspace &rarr;</span>
              </button>
            </div>
          )}
        </div>

        {/* Subtle decorative background motif */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none hidden md:block">
          <img
            src="/src/assets/images/roadguard_hero_inspection_1790958611333.jpg"
            alt="Road surface"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 2. Personal Statistics Only (Strictly personal, no municipal system telemetry) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Reports Submitted</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {stats.submitted}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">by you</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Under Inspection / Repair</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {stats.underInspection}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">active crews</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Resolved & Certified</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {stats.resolved}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">remediated</span>
          </div>
        </div>
      </div>

      {/* 3. Recent Reports & Nearby Issues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Reports Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">What is happening with my reports?</h3>
            <button
              onClick={onNavigateToMyReports}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              View all ({myReports.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentReports.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-300 font-medium">No reports submitted yet.</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Help improve municipal safety by reporting potholes in your daily commute.
              </p>
              <button
                onClick={() => onOpenReportModal()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm"
              >
                Report Your First Problem
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReports.map((issue) => {
                const statusBadge =
                  issue.status === 'resolved'
                    ? { text: 'Resolved', color: 'text-emerald-400' }
                    : issue.status === 'in_repair'
                    ? { text: 'Repair Underway', color: 'text-amber-400' }
                    : issue.status === 'inspection_scheduled'
                    ? { text: 'Under Inspection', color: 'text-blue-400' }
                    : { text: 'Municipality Notified', color: 'text-amber-300' };

                return (
                  <div
                    key={issue.id}
                    onClick={() => onOpenIssueDetails(issue)}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-900 hover:bg-slate-850 hover:border-slate-700 active:bg-slate-800/80 active:scale-[0.99] border border-slate-800 transition-all cursor-pointer space-y-2 group shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
                          {issue.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{issue.location.street || issue.location.area}</span>
                        </div>
                      </div>

                      {/* Clean Unboxed Status Label (Anti-Pill discipline) */}
                      <span className={`text-xs font-semibold ${statusBadge.color}`}>
                        {statusBadge.text}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                      <span>Ref: {issue.referenceNumber}</span>
                      <span>{new Date(issue.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nearby Road Map Preview Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Road Problems Around You</h3>
            <button
              onClick={onNavigateToMap}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              Open Full Map
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-sm">
            <LeafletMap
              issues={issues}
              role="citizen"
              userLocation={userLocation}
              onLocationUpdate={onLocationUpdate}
              onSelectIssue={onOpenIssueDetails}
              height="310px"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
