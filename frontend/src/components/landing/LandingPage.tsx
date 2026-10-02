import React from 'react';
import { UserRole } from '../../types';
import heroInspectionImg from '../../assets/images/roadguard_hero_inspection_1790958611333.jpg';
import {
  Camera,
  Shield,
  Wrench,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Building2,
  Eye,
  FileCheck,
} from 'lucide-react';

interface LandingPageProps {
  onEnterRole: (role: UserRole) => void;
  onOpenReportModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterRole,
  onOpenReportModal,
}) => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-8 sm:p-14 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Municipal Infrastructure</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight text-balance">
            Safer Urban Roads Through Instant AI Pothole Detection & Rapid Remediation
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            RoadGuard AI bridges citizens, field repair crews, and municipal inspectors into a unified response loop. Report asphalt distress in seconds, automatically classify severity, and track municipal road restoration in real time.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onOpenReportModal}
              className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Report a Road Problem (No Login Needed)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onEnterRole('inspector')}
              className="flex items-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Municipal Operations Console</span>
            </button>
          </div>
        </div>

        {/* Hero Background Visual */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none hidden lg:block overflow-hidden">
          <img
            src={heroInspectionImg}
            alt="Road surface inspection"
            className="w-full h-full object-cover mix-blend-luminosity"
          />
        </div>
      </section>

      {/* 3 Dedicated Role Pathways (Core Product Direction) */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            Tailored Experiences for Every Stakeholder
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Select your role to explore the tailored information hierarchy and tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Citizen Portal */}
          <div
            onClick={() => onEnterRole('citizen')}
            className="p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                Citizen Portal
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Take a photo or video of a pothole, pinpoint location, notify the municipal authority, and track real-time repair progress without complex technical clutter.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>Enter Citizen View &rarr;</span>
            </div>
          </div>

          {/* 2. Field Technician */}
          <div
            onClick={() => onEnterRole('worker')}
            className="p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                Field Technician
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Action-oriented daily work orders, turn-by-turn route navigation, inspection checklists, depth measurements, and instant status updates for quick-response crews.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>Enter Worker View &rarr;</span>
            </div>
          </div>

          {/* 3. Municipal Inspector */}
          <div
            onClick={() => onEnterRole('inspector')}
            className="p-6 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                Municipal Inspector
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full-city map oversight, automated severity filtering, crew dispatch balancing, official audit PDF generation, and quantitative road quality analytics.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>Enter Inspector View &rarr;</span>
            </div>
          </div>
        </div>
      </section>

      {/* Proof & Municipal Operational Metrics (Claim-to-Proof Adjacency) */}
      <section className="p-8 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 tabular-nums">
              &lt; 24h
            </span>
            <span className="text-xs text-slate-400 block mt-1">Average Response SLA</span>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tabular-nums">
              96.2%
            </span>
            <span className="text-xs text-slate-400 block mt-1">Detection Accuracy</span>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100 tabular-nums">
              4 Zones
            </span>
            <span className="text-xs text-slate-400 block mt-1">Tri-City Municipalities</span>
          </div>

          <div>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-blue-400 tabular-nums">
              100%
            </span>
            <span className="text-xs text-slate-400 block mt-1">Audit Trail Transparency</span>
          </div>
        </div>
      </section>
    </div>
  );
};
