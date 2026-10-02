import React, { useState } from 'react';
import { User, UserRole, AppNotification, ServerHealth } from '../../types';
import { storage } from '../../services/storage';
import {
  Bell,
  User as UserIcon,
  ChevronDown,
  Shield,
  Wrench,
  CheckCircle2,
  X,
  LogOut,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Scan,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  activeRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
  onOpenReportModal: () => void;
  onOpenAuthModal: () => void;
  notifications: AppNotification[];
  onMarkNotificationsRead: () => void;
  onOpenSettings?: () => void;
  activeNavTab?: string;
  onSelectNavTab?: (tab: string) => void;
  currentTheme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  serverHealth?: ServerHealth | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeRole,
  onRoleChange,
  onOpenReportModal,
  onOpenAuthModal,
  notifications,
  onMarkNotificationsRead,
  onOpenSettings,
  activeNavTab,
  onSelectNavTab,
  currentTheme = 'dark',
  onToggleTheme,
  serverHealth,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const roleTitles: Record<UserRole, { label: string; desc: string }> = {
    citizen: { label: 'Citizen Portal', desc: 'Report & Track' },
    worker: { label: 'Field Technician', desc: 'Work Orders & Inspection' },
    inspector: { label: 'Municipal Inspector', desc: 'Full Oversight & Dispatch' },
  };

  const getStatusInfo = () => {
    if (!serverHealth) {
      return {
        label: 'Offline',
        color: 'bg-rose-500',
        title: 'Backend server not reachable',
      };
    }
    if (serverHealth.modelReachable) {
      return {
        label: 'YOLOv11 Active',
        color: 'bg-emerald-500',
        title: 'Roboflow YOLOv11 segmentation model ready',
      };
    }
    if (serverHealth.apiKeyConfigured) {
      return {
        label: 'Model Ready',
        color: 'bg-amber-500',
        title: 'Roboflow key configured',
      };
    }
    return {
      label: 'Connecting',
      color: 'bg-amber-400',
      title: 'Connecting to inference server',
    };
  };

  const status = getStatusInfo();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (onSelectNavTab) onSelectNavTab('home');
            }}
            className="flex items-center gap-2 text-slate-100 group shrink-0"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              RG
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-100 font-sans">
              <span>RoadGuard</span><span className="text-amber-400">AI</span>
            </span>
          </a>

          {/* Quick Role Switcher Chip */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-medium transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
              <span className="capitalize">{activeRole}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {showRoleMenu && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-xs">
                <div className="px-3 py-1.5 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800 mb-1">
                  Switch Active Role
                </div>
                {(['citizen', 'worker', 'inspector'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onRoleChange(role);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                      activeRole === role
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="capitalize">{roleTitles[role].label}</div>
                      <div className="text-[11px] text-slate-400">{roleTitles[role].desc}</div>
                    </div>
                    {activeRole === role && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Navigation Links (Clean text links with subtle hover, single-line) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          {activeRole === 'citizen' && (
            <>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('home')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'home' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('detection')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'detection' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Detection Studio
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('reports')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'reports' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                My Reports
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('map')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'map' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Road Map
              </button>
            </>
          )}

          {activeRole === 'worker' && (
            <>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('dashboard')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'dashboard' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Today's Work
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('tasks')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'tasks' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('map')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'map' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Route Map
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('detection')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'detection' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Detection Studio
              </button>
            </>
          )}

          {activeRole === 'inspector' && (
            <>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('overview')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'overview' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('issues')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'issues' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Road Issues
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('assignments')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'assignments' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Assignments
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('map')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'map' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Live Map
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('reports')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'reports' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => onSelectNavTab && onSelectNavTab('analytics')}
                className={`hover:text-slate-100 transition-colors ${
                  activeNavTab === 'analytics' ? 'text-amber-400 font-semibold' : ''
                }`}
              >
                Analytics
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Primary Actions (Health Badge, Theme Toggle, Report CTA, Notification Icon, User Profile) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Real Backend / AI Status Badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300"
            title={status.title}
          >
            <span className={`w-2 h-2 rounded-full ${status.color} shadow-sm`} />
            <span>{status.label}</span>
          </div>

          {/* Light / Dark Mode Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Color Theme"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          )}

          {activeRole === 'citizen' && (
            <button
              onClick={onOpenReportModal}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>+ Report Problem</span>
            </button>
          )}

          {/* Notifications Icon */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                if (!showNotifMenu) onMarkNotificationsRead();
              }}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 relative transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-mono text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Notifications</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{activeRole} Alerts</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-lg border transition-colors ${
                          n.read
                            ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400'
                            : 'bg-amber-50 dark:bg-slate-950 border-amber-300 dark:border-amber-500/30 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-0.5">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{n.timestamp}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account / Profile button */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                {currentUser ? currentUser.name[0] : 'G'}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                {currentUser ? currentUser.name : 'Guest'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {currentUser ? currentUser.name : 'Guest User'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser ? currentUser.email : 'Unauthenticated'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenAuthModal();
                  }}
                  className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>{currentUser ? 'Switch User / Login' : 'Sign In / Register'}</span>
                </button>

                {onOpenSettings && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Municipal Demo Settings</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
