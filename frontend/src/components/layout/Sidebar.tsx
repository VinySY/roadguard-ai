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
  HelpCircle,
  LogOut,
  Bell,
  Building2,
} from 'lucide-react';

interface SidebarProps {
  activeRole: UserRole;
  currentNav: string;
  onSelectNav: (nav: string) => void;
  onOpenReportModal: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeRole,
  currentNav,
  onSelectNav,
  onOpenReportModal,
  currentUser,
  onOpenAuth,
  onOpenSettings,
}) => {
  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-white/80 dark:bg-slate-950/80 border-r border-slate-200 dark:border-slate-800 p-3 shrink-0 h-full overflow-y-auto select-none transition-colors">
      {/* Role Kicker */}
      <div className="px-2.5 py-1.5 mb-2.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
          Current Workspace
        </span>
        <span className="text-slate-900 dark:text-slate-200 font-semibold capitalize flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          {activeRole === 'citizen'
            ? 'Citizen Portal'
            : activeRole === 'worker'
            ? 'Field Crew Workstation'
            : 'Municipal Operations Desk'}
        </span>
      </div>

      {/* Navigation Links depending on role */}
      <nav className="space-y-1 flex-1 overflow-y-auto">
        {/* CITIZEN NAV */}
        {activeRole === 'citizen' && (
          <>
            <button
              onClick={() => onSelectNav('home')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'home'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Home Dashboard</span>
            </button>

            <button
              onClick={onOpenReportModal}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-sm transition-colors my-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report a Problem</span>
            </button>

            <button
              onClick={() => onSelectNav('detection')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'detection'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Detection Studio</span>
            </button>

            <button
              onClick={() => onSelectNav('reports')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'reports'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>My Reports</span>
            </button>

            <button
              onClick={() => onSelectNav('map')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'map'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Road Map</span>
            </button>
          </>
        )}

        {/* WORKER NAV */}
        {activeRole === 'worker' && (
          <>
            <button
              onClick={() => onSelectNav('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'dashboard'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Today's Work</span>
            </button>

            <button
              onClick={() => onSelectNav('tasks')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'tasks'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>My Tasks</span>
            </button>

            <button
              onClick={() => onSelectNav('map')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'map'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Assigned Route Map</span>
            </button>

            <button
              onClick={() => onSelectNav('detection')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'detection'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Detection Studio</span>
            </button>
          </>
        )}

        {/* INSPECTOR NAV */}
        {activeRole === 'inspector' && (
          <>
            <button
              onClick={() => onSelectNav('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'overview'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Operations Overview</span>
            </button>

            <button
              onClick={() => onSelectNav('map')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'map'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Live Municipal Map</span>
            </button>

            <button
              onClick={() => onSelectNav('issues')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'issues'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Road Issues Registry</span>
            </button>

            <button
              onClick={() => onSelectNav('assignments')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'assignments'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Crew Assignments</span>
            </button>

            <button
              onClick={() => onSelectNav('reports')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'reports'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Executive Reports</span>
            </button>

            <button
              onClick={() => onSelectNav('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'analytics'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Pavement Analytics</span>
            </button>

            <button
              onClick={() => onSelectNav('detection')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                currentNav === 'detection'
                  ? 'bg-amber-500/10 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Detection Studio</span>
            </button>
          </>
        )}
      </nav>

      {/* Secondary & Bottom Profile Links */}
      <div className="pt-4 border-t border-slate-800 space-y-1">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Demo Municipal Settings</span>
        </button>

        <button
          onClick={onOpenAuth}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{currentUser ? 'Switch / Sign Out' : 'Sign In'}</span>
        </button>
      </div>
    </aside>
  );
};
