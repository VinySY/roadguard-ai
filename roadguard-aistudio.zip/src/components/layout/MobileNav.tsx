import React from 'react';
import { UserRole } from '../../types';
import { Home, PlusCircle, FileText, MapPin, ClipboardList, Wrench, Layers, User as UserIcon, Camera } from 'lucide-react';

interface MobileNavProps {
  activeRole: UserRole;
  currentNav: string;
  onSelectNav: (nav: string) => void;
  onOpenReportModal: () => void;
  onOpenAuth: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeRole,
  currentNav,
  onSelectNav,
  onOpenReportModal,
  onOpenAuth,
}) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800/90 px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none shadow-[0_-4px_24px_rgba(0,0,0,0.6)]"
    >
      {activeRole === 'citizen' && (
        <>
          <button
            onClick={() => onSelectNav('home')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'home'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Home</span>
          </button>

          <button
            onClick={() => onSelectNav('reports')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'reports'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Reports</span>
          </button>

          {/* Prominent Center Detection Studio Action */}
          <div className="flex-1 flex justify-center -mt-4 shrink-0">
            <button
              onClick={() => onSelectNav('detection')}
              className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 transition-transform border-2 border-slate-950"
              aria-label="Detection Studio"
              title="Detection Studio"
            >
              <Camera className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          <button
            onClick={() => onSelectNav('map')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'map'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Map</span>
          </button>

          <button
            onClick={onOpenAuth}
            className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Profile</span>
          </button>
        </>
      )}

      {activeRole === 'worker' && (
        <>
          <button
            onClick={() => onSelectNav('dashboard')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'dashboard'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Today</span>
          </button>

          <button
            onClick={() => onSelectNav('tasks')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'tasks'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Tasks</span>
          </button>

          <button
            onClick={() => onSelectNav('map')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'map'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Route</span>
          </button>

          <button
            onClick={() => onSelectNav('detection')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'detection'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Studio</span>
          </button>
        </>
      )}

      {activeRole === 'inspector' && (
        <>
          <button
            onClick={() => onSelectNav('overview')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'overview'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Overview</span>
          </button>

          <button
            onClick={() => onSelectNav('issues')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'issues'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Issues</span>
          </button>

          <button
            onClick={() => onSelectNav('map')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'map'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Map</span>
          </button>

          <button
            onClick={() => onSelectNav('reports')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-lg transition-colors ${
              currentNav === 'reports'
                ? 'text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">Reports</span>
          </button>
        </>
      )}
    </nav>
  );
};
