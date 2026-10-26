import React from 'react';
import { RoadIssue, LocationCoordinates, User } from '../../types';
import heroImg from '../../assets/images/roadguard_hero_inspection_1790958611333.jpg';
import {
  Plus,
  MapPin,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  Camera,
} from 'lucide-react';
import { LeafletMap } from '../map/LeafletMap';
import { EvidenceInputGrid } from '../detection/EvidenceInputGrid';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';

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
  // Personal reports only — no municipal-wide telemetry on the citizen view.
  const myReports = issues.filter(
    (i) =>
      i.reportedBy.userId === currentUser?.id ||
      (!currentUser && i.reportedBy.isGuest) ||
      i.reportedBy.name === currentUser?.name
  );

  const stats = {
    submitted: myReports.length,
    underInspection: myReports.filter(
      (i) =>
        i.status === 'inspection_scheduled' ||
        i.status === 'notified_municipality' ||
        i.status === 'in_repair'
    ).length,
    resolved: myReports.filter((i) => i.status === 'resolved').length,
  };

  const recentReports = myReports.slice(0, 3);
  const firstName = currentUser?.name?.split(' ')[0];

  return (
    <div className="w-full space-y-6">
      {/* Reporting hero */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-slate-900/80 shadow-[0_24px_60px_-30px_rgba(2,6,23,0.9)]">
        <div className="relative z-10 max-w-3xl space-y-4 p-5 sm:p-7">
          <span className="rg-kicker">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Citizen road reporting
          </span>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 text-balance sm:text-3xl">
              {firstName ? `${firstName}, report a road problem` : 'Report a road problem'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Take a photo, upload an image, record a video, or upload dashcam footage. RoadGuard AI
              detects potholes, estimates severity, and routes the report to the right municipal crew.
            </p>
          </div>

          <EvidenceInputGrid isActionOnly onSelectMethod={(method) => onOpenReportModal(method)} />

          {onNavigateToDetection && (
            <button
              type="button"
              onClick={() => onNavigateToDetection()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Open the full Detection Studio
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 md:block">
          <img src={heroImg} alt="" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent" />
        </div>
      </section>

      {/* Personal statistics */}
      <section aria-label="Your reporting summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Reports submitted"
          value={stats.submitted}
          note="By you"
          icon={FileText}
          tone="default"
        />
        <StatCard
          label="Under inspection / repair"
          value={stats.underInspection}
          note="Active municipal work"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          note="Repairs completed"
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Personal reports */}
        <section className="space-y-3" aria-labelledby="my-reports-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="my-reports-heading" className="text-sm font-semibold text-slate-100">
              Your recent reports
            </h2>
            <button
              type="button"
              onClick={onNavigateToMyReports}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
            >
              View all ({myReports.length})
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {recentReports.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No reports submitted yet"
              description="Help improve road safety by reporting potholes on your daily commute."
              action={
                <button type="button" onClick={() => onOpenReportModal()} className="rg-btn rg-btn-primary">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Report your first problem
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentReports.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onOpenIssueDetails(issue)}
                  className="rg-card rg-card-interactive block w-full space-y-2 p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{issue.title}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{issue.location.street || issue.location.area}</span>
                      </p>
                    </div>
                    <StatusBadge status={issue.status} />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-700/40 pt-2 font-mono text-[11px] text-slate-500">
                    <span>Ref {issue.referenceNumber}</span>
                    <span>
                      {new Date(issue.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Nearby map */}
        <section className="space-y-3" aria-labelledby="nearby-map-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="nearby-map-heading" className="text-sm font-semibold text-slate-100">
              Road problems around you
            </h2>
            <button
              type="button"
              onClick={onNavigateToMap}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
            >
              Open full map
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-700/60 shadow-lg">
            <LeafletMap
              issues={issues}
              role="citizen"
              userLocation={userLocation}
              onLocationUpdate={onLocationUpdate}
              onSelectIssue={onOpenIssueDetails}
              height="300px"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
