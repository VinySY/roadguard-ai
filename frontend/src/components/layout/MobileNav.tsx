import React from 'react';
import { UserRole } from '../../types';
import {
  Home,
  FileText,
  MapPin,
  ClipboardList,
  Wrench,
  Layers,
  User as UserIcon,
  Camera,
  BarChart3,
} from 'lucide-react';

interface MobileNavProps {
  activeRole: UserRole;
  currentNav: string;
  onSelectNav: (nav: string) => void;
  onOpenReportModal: () => void;
  onOpenAuth: () => void;
}

interface MobileItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ITEMS: Record<Exclude<UserRole, 'citizen'>, MobileItem[]> = {
  worker: [
    { id: 'dashboard', label: 'Today', icon: <ClipboardList className="h-4 w-4" aria-hidden="true" /> },
    { id: 'tasks', label: 'Tasks', icon: <Wrench className="h-4 w-4" aria-hidden="true" /> },
    { id: 'map', label: 'Route', icon: <MapPin className="h-4 w-4" aria-hidden="true" /> },
    { id: 'detection', label: 'Studio', icon: <Camera className="h-4 w-4" aria-hidden="true" /> },
  ],
  inspector: [
    { id: 'overview', label: 'Overview', icon: <Home className="h-4 w-4" aria-hidden="true" /> },
    { id: 'issues', label: 'Issues', icon: <Layers className="h-4 w-4" aria-hidden="true" /> },
    { id: 'map', label: 'Map', icon: <MapPin className="h-4 w-4" aria-hidden="true" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" aria-hidden="true" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
  ],
};

const MobileNavButton: React.FC<{
  item: MobileItem;
  active: boolean;
  onSelect: () => void;
}> = ({ item, active, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-current={active ? 'page' : undefined}
    className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 transition-colors ${
      active ? 'font-semibold text-amber-400' : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    {item.icon}
    <span className="text-[10px] leading-tight">{item.label}</span>
  </button>
);

export const MobileNav: React.FC<MobileNavProps> = ({
  activeRole,
  currentNav,
  onSelectNav,
  onOpenAuth,
}) => {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-800/90 bg-slate-950/95 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:hidden"
    >
      {activeRole === 'citizen' && (
        <>
          <MobileNavButton
            item={{ id: 'home', label: 'Home', icon: <Home className="h-4 w-4" aria-hidden="true" /> }}
            active={currentNav === 'home'}
            onSelect={() => onSelectNav('home')}
          />
          <MobileNavButton
            item={{ id: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" aria-hidden="true" /> }}
            active={currentNav === 'reports'}
            onSelect={() => onSelectNav('reports')}
          />

          {/* Prominent centre capture action */}
          <div className="-mt-5 flex shrink-0 flex-1 justify-center">
            <button
              type="button"
              onClick={() => onSelectNav('detection')}
              aria-current={currentNav === 'detection' ? 'page' : undefined}
              aria-label="Open Detection Studio"
              title="Detection Studio"
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-950 shadow-lg transition-transform active:scale-95 ${
                currentNav === 'detection'
                  ? 'bg-amber-400 text-slate-950 shadow-amber-500/30'
                  : 'bg-amber-500 text-slate-950 shadow-amber-500/25 hover:bg-amber-400'
              }`}
            >
              <Camera className="h-5 w-5 stroke-[2.2]" aria-hidden="true" />
            </button>
          </div>

          <MobileNavButton
            item={{ id: 'map', label: 'Map', icon: <MapPin className="h-4 w-4" aria-hidden="true" /> }}
            active={currentNav === 'map'}
            onSelect={() => onSelectNav('map')}
          />
          <MobileNavButton
            item={{ id: 'profile', label: 'Profile', icon: <UserIcon className="h-4 w-4" aria-hidden="true" /> }}
            active={false}
            onSelect={onOpenAuth}
          />
        </>
      )}

      {activeRole !== 'citizen' &&
        ITEMS[activeRole].map((item) => (
          <MobileNavButton
            key={item.id}
            item={item}
            active={currentNav === item.id}
            onSelect={() => onSelectNav(item.id)}
          />
        ))}
    </nav>
  );
};
