import React from 'react';
import { UserRole } from '../../types';
import heroInspectionImg from '../../assets/images/roadguard_hero_inspection_1790958611333.jpg';
import evidenceImg from '../../assets/images/roadguard_pothole_evidence_1790958622590.jpg';
import municipalImg from '../../assets/images/roadguard_municipal_operations_1790958647322.jpg';
import workerImg from '../../assets/images/roadguard_worker_field_1790958635986.jpg';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Film,
  Gauge,
  MapPin,
  ScanLine,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

interface LandingPageProps {
  onEnterRole: (role: UserRole) => void;
  onOpenReportModal: () => void;
  onStartDetection: () => void;
  onExploreMap: () => void;
}

const capabilities = [
  {
    icon: ScanLine,
    title: 'Segmentation-based detection',
    description:
      'Road images are analysed by the Roboflow pothole-detection-itsgr segmentation model, returning real masks, confidence values and severity.',
  },
  {
    icon: Film,
    title: 'Image and video evidence',
    description:
      'Upload a photograph or dashcam footage, capture live from a device camera, and inspect frame-level detections in the same workspace.',
  },
  {
    icon: MapPin,
    title: 'Location-aware reporting',
    description:
      'Pin the exact defect on the Streets map, confirm the address, and route the report to the responsible municipal desk.',
  },
  {
    icon: BarChart3,
    title: 'Operational analytics',
    description:
      'Severity distribution, zone concentration, repair backlog and resolution progress are derived from the reports already in the system.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based workspaces',
    description:
      'Citizens report and track, field crews manage inspections, and municipal inspectors oversee dispatch and road condition.',
  },
  {
    icon: FileText,
    title: 'Auditable report trail',
    description:
      'Reference numbers, status history, field measurements and photographic evidence stay attached to every incident.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterRole,
  onOpenReportModal,
  onStartDetection,
  onExploreMap,
}) => {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-20 pb-16">
      {/* Hero */}
      <section className="rg-animate-in relative overflow-hidden rounded-[26px] border border-slate-700/60 bg-slate-950/60 shadow-2xl">
        <div className="absolute inset-0">
          <img
            src={heroInspectionImg}
            alt="Road surface inspection"
            className="h-full w-full object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1120] via-[#0b1120]/92 to-[#0b1120]/30" />
          <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_82%_10%,rgba(245,158,11,0.16),transparent_62%)]" />
        </div>

        <div className="relative z-10 grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-14">
          <div className="max-w-2xl">
            <div className="rg-kicker">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              AI road-safety operations platform
            </div>

            <h1 className="mt-5 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl lg:text-[3.35rem]">
              Find road defects faster.
              <span className="block text-amber-400">Get them repaired sooner.</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              RoadGuard AI connects citizens, field crews and municipal inspectors around one
              verified record: a photograph, a real segmentation result, an exact location, and a
              repair trail that everyone can follow.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={onStartDetection} className="rg-btn rg-btn-primary rg-btn-lg">
                <Camera className="h-4 w-4" aria-hidden="true" />
                Start Detection
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={onExploreMap} className="rg-btn rg-btn-secondary rg-btn-lg">
                <MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />
                Explore Road Map
              </button>
              <button type="button" onClick={onOpenReportModal} className="rg-btn rg-btn-ghost rg-btn-lg">
                Report a pothole
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-700/50 pt-4 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                No account needed to report
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                Real model inference
              </span>
              <span className="font-mono text-slate-500">Roboflow · pothole-detection-itsgr · v1</span>
            </div>
          </div>

          {/* Product evidence card */}
          <div className="rg-glass-strong relative hidden overflow-hidden rounded-2xl lg:block">
            <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300">
                  Inspection evidence
                </span>
              </div>
              <span className="rg-badge rg-badge-neutral">Actual report photo</span>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
              <img
                src={evidenceImg}
                alt="Reported pothole evidence from the RoadGuard project"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 backdrop-blur-md">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">Pothole evidence</p>
                  <p className="font-mono text-[10px] text-slate-400">GPS + photograph attached</p>
                </div>
                <span className="rg-badge rg-badge-amber">Segmentation</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-700/60 border-t border-slate-700/60 text-center">
              {[
                { label: 'Detection', value: 'Image / video' },
                { label: 'Location', value: 'Map pin' },
                { label: 'Handoff', value: 'Municipal' },
              ].map((item) => (
                <div key={item.label} className="px-2 py-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-200">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capability grid */}
      <section className="space-y-7">
        <div className="max-w-2xl">
          <p className="rg-kicker">Built on the existing platform</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            Everything needed to close the road-repair loop
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            These are the workflows already wired into the application — no fabricated dashboards,
            placeholder metrics or simulated detections.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <article key={capability.title} className="rg-card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-100">{capability.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{capability.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Workflow */}
      <section className="rg-panel overflow-hidden rounded-2xl">
        <div className="grid gap-0 lg:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Capture & detect',
              description:
                'Upload a photo or video, or use the live camera. The existing Roboflow pipeline returns segmentation masks, confidence and severity.',
              icon: Camera,
            },
            {
              step: '02',
              title: 'Locate & verify',
              description:
                'Confirm the street address, use GPS, or open Pin on Map to drop a marker on the exact carriageway location.',
              icon: MapPin,
            },
            {
              step: '03',
              title: 'Dispatch & track',
              description:
                'The report is logged with evidence and routed to the responsible municipal desk, then tracked through repair.',
              icon: Building2,
            },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className={`p-6 sm:p-8 ${index > 0 ? 'border-t border-slate-700/50 lg:border-l lg:border-t-0' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-amber-400">{item.step}</span>
                  <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-100">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Role pathways with real imagery */}
      <section className="space-y-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="rg-kicker">Choose your workspace</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100">One platform, three operational views</h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-400">
            Switch roles at any time from the header. Each workspace keeps the same reports, map and
            detection pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              role: 'citizen' as UserRole,
              title: 'Citizen Portal',
              description: 'Report a road problem, attach evidence, pin the location and follow the repair status.',
              image: evidenceImg,
              icon: Camera,
            },
            {
              role: 'worker' as UserRole,
              title: 'Field Technician',
              description: 'Open assigned work orders, review evidence, record measurements and update field status.',
              image: workerImg,
              icon: Wrench,
            },
            {
              role: 'inspector' as UserRole,
              title: 'Municipal Inspector',
              description: 'Oversee the city map, triage severity, assign crews and review pavement analytics.',
              image: municipalImg,
              icon: ShieldCheck,
            },
          ].map((path) => {
            const Icon = path.icon;
            return (
              <button
                key={path.role}
                type="button"
                onClick={() => onEnterRole(path.role)}
                className="rg-card rg-card-interactive group overflow-hidden text-left"
              >
                <div className="relative h-40 overflow-hidden bg-slate-900">
                  <img
                    src={path.image}
                    alt=""
                    className="h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-slate-950/80 text-amber-400 backdrop-blur-sm">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-white">{path.title}</span>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-xs leading-relaxed text-slate-400">{path.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    Enter workspace
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 pt-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-xs font-bold text-slate-950">
              RG
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">RoadGuard AI</p>
              <p className="text-[11px] text-slate-500">Road-safety intelligence for citizens and municipalities.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
            <button type="button" onClick={onStartDetection} className="hover:text-amber-400">Detection Studio</button>
            <button type="button" onClick={onExploreMap} className="hover:text-amber-400">Road Map</button>
            <button type="button" onClick={onOpenReportModal} className="hover:text-amber-400">Report a problem</button>
            <span className="font-mono text-slate-600">Roboflow segmentation · MySQL persistence</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
