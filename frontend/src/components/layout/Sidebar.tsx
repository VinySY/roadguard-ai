import React from 'react';
import { UserRole, User } from '../../types';
import {
  Home,
  PlusCircle,
  FileText,
  MapPin,
  ClipboardList,
  Wrench,
  Camera,
  Layers,
  BarChart3,
  UserCheck,
  Settings,
  LogIn,
  Building2,
  Compass,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  activeRole: UserRole;
  currentNav: string;
  onSelectNav: (nav: string) => void;
  onOpenReportModal: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onGoToLanding?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ROLE_WORKSPACE: Record<UserRole, { label: string; blurb: string; icon: React.ReactNode }> = {
  citizen: {
    label: 'Citizen Portal',
    blurb: 'Report and track hazards',
    icon: <Home className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  worker: {
    label: 'Field Crew',
    blurb: 'Work orders and inspections',
    icon: <Wrench className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  inspector: {
    label: 'Municipal Desk',
    blurb: 'Oversight, dispatch and analytics',
    icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  },
};

const ROLE_NAV: Record<UserRole, { section: string; items: NavItem[] }[]> = {
  citizen: [
    {
      section: 'Workspace',
      items: [
        { id: 'home', label: 'Home Dashboard', icon: <Home className="h-4 w-4" aria-hidden="true" /> },
        { id: 'detection', label: 'Detection Studio', icon: <Camera className="h-4 w-4" aria-hidden="true" /> },
        { id: 'reports', label: 'My Reports', icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
        { id: 'map', label: 'Road Map', icon: <MapPin className="h-4 w-4" aria-hidden="true" /> },
      ],
    },
  ],
  worker: [
    {
      section: 'Field operations',
      items: [
        { id: 'dashboard', label: "Today's Work", icon: <ClipboardList className="h-4 w-4" aria-hidden="true" /> },
        { id: 'tasks', label: 'My Tasks', icon: <Wrench className="h-4 w-4" aria-hidden="true" /> },
        { id: 'map', label: 'Assigned Route', icon: <MapPin className="h-4 w-4" aria-hidden="true" /> },
        { id: 'detection', label: 'Detection Studio', icon: <Camera className="h-4 w-4" aria-hidden="true" /> },
      ],
    },
  ],
  inspector: [
    {
      section: 'Operations',
      items: [
        { id: 'overview', label: 'Operations Overview', icon: <Home className="h-4 w-4" aria-hidden="true" /> },
        { id: 'map', label: 'Live Municipal Map', icon: <MapPin className="h-4 w-4" aria-hidden="true" /> },
        { id: 'issues', label: 'Road Issues Registry', icon: <Layers className="h-4 w-4" aria-hidden="true" /> },
        { id: 'assignments', label: 'Crew Assignments', icon: <UserCheck className="h-4 w-4" aria-hidden="true" /> },
      ],
    },
    {
      section: 'Insight',
      items: [
        { id: 'reports', label: 'Executive Reports', icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
        { id: 'analytics', label: 'Pavement Analytics', icon: <BarChart3 className="h-4 w-4" aria-hidden="true" /> },
        { id: 'detection', label: 'Detection Studio', icon: <Camera className="h-4 w-4" aria-hidden="true" /> },
      ],
    },
  ],
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeRole,
  currentNav,
  onSelectNav,
  onOpenReportModal,
  currentUser,
  onOpenAuth,
  onOpenSettings,
  onGoToLanding,
}) => {
  const workspace = ROLE_WORKSPACE[activeRole];

  return (
    <aside className="hidden h-full w-56 shrink-0 select-none flex-col overflow-y-auto border-r border-slate-800/70 bg-slate-950/60 p-3 backdrop-blur-xl lg:flex xl:w-60">
      {/* Workspace identity */}
      <div className="mb-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
        <span className="rg-nav-section !px-0 !pt-0">Current workspace</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
            {workspace.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-100">{workspace.label}</div>
            <div className="truncate text-[10px] text-slate-500">{workspace.blurb}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
        {activeRole === 'citizen' && (
          <button
            type="button"
            onClick={onOpenReportModal}
            className="rg-btn rg-btn-primary mb-3 w-full justify-start"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>Report a Problem</span>
          </button>
        )}

        {ROLE_NAV[activeRole].map((group) => (
          <div key={group.section} className="space-y-0.5">
            <div className="rg-nav-section">{group.section}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                aria-current={currentNav === item.id ? 'page' : undefined}
                className="rg-nav-item"
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Utility links */}
      <div className="mt-3 space-y-0.5 border-t border-slate-800/80 pt-3">
        {onGoToLanding && (
          <button type="button" onClick={onGoToLanding} className="rg-nav-item">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <span>Platform Overview</span>
          </button>
        )}
        <button type="button" onClick={onOpenSettings} className="rg-nav-item">
          <Settings className="h-4 w-4" aria-hidden="true" />
          <span>Municipal Settings</span>
        </button>
        <button type="button" onClick={onOpenAuth} className="rg-nav-item">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          <span>{currentUser ? 'Switch user' : 'Sign in'}</span>
        </button>

        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-900/40 px-2.5 py-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium text-slate-300">
              {currentUser ? currentUser.name : 'Guest session'}
            </div>
            <div className="truncate text-[10px] text-slate-500">
              {currentUser ? currentUser.email : 'Not signed in'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
