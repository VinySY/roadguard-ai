import React, { useEffect, useRef, useState } from 'react';
import { User, UserRole, AppNotification, ServerHealth } from '../../types';
import {
  Bell,
  User as UserIcon,
  ChevronDown,
  Settings,
  LogOut,
  LifeBuoy,
  ShieldCheck,
  Wrench,
  Compass,
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
  onGoToLanding?: () => void;
  onSignOut?: () => void;
  serverHealth?: ServerHealth | null;
}

interface NavLink {
  id: string;
  label: string;
}

const ROLE_META: Record<
  UserRole,
  { label: string; desc: string; icon: React.ReactNode }
> = {
  citizen: {
    label: 'Citizen Portal',
    desc: 'Report & track road hazards',
    icon: <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  worker: {
    label: 'Field Technician',
    desc: 'Work orders & inspections',
    icon: <Wrench className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  inspector: {
    label: 'Municipal Inspector',
    desc: 'Oversight, dispatch & analytics',
    icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  },
};

const ROLE_NAV: Record<UserRole, NavLink[]> = {
  citizen: [
    { id: 'home', label: 'Dashboard' },
    { id: 'detection', label: 'Detection Studio' },
    { id: 'reports', label: 'My Reports' },
    { id: 'map', label: 'Road Map' },
  ],
  worker: [
    { id: 'dashboard', label: "Today's Work" },
    { id: 'tasks', label: 'My Tasks' },
    { id: 'map', label: 'Route Map' },
    { id: 'detection', label: 'Detection Studio' },
  ],
  inspector: [
    { id: 'overview', label: 'Overview' },
    { id: 'issues', label: 'Road Issues' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'map', label: 'Live Map' },
    { id: 'reports', label: 'Reports' },
    { id: 'analytics', label: 'Analytics' },
  ],
};

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
  onGoToLanding,
  onSignOut,
  serverHealth,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const roleMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const navLinks = ROLE_NAV[activeRole];

  const closeAllMenus = () => {
    setShowRoleMenu(false);
    setShowNotifMenu(false);
    setShowUserMenu(false);
  };

  // Escape closes menus; pointer-down outside dismisses them.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAllMenus();
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !roleMenuRef.current?.contains(target) &&
        !notifMenuRef.current?.contains(target) &&
        !userMenuRef.current?.contains(target)
      ) {
        closeAllMenus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  const getStatusInfo = () => {
    if (!serverHealth) {
      return {
        label: 'Service offline',
        dot: 'bg-rose-500',
        title: 'Backend server not reachable',
      };
    }
    if (serverHealth.modelReachable) {
      return {
        label: 'AI service online',
        dot: 'bg-emerald-500',
        title: 'Roboflow segmentation endpoint reachable',
      };
    }
    if (serverHealth.apiKeyConfigured) {
      return {
        label: 'API configured',
        dot: 'bg-amber-500',
        title: 'Roboflow key configured; model probe unavailable',
      };
    }
    return {
      label: 'Connecting',
      dot: 'bg-amber-400',
      title: 'Connecting to the inference service',
    };
  };

  const status = getStatusInfo();

  const goToPlatform = () => {
    closeAllMenus();
    if (onGoToLanding) onGoToLanding();
    else onSelectNavTab?.('home');
  };

  const selectNav = (tab: string) => {
    closeAllMenus();
    onSelectNavTab?.(tab);
  };

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 border-b border-slate-700/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        {/* Zone 1: Wordmark + workspace switcher */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={goToPlatform}
            className="group flex shrink-0 items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
            aria-label="RoadGuard AI — platform overview"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition-transform group-hover:scale-105">
              RG
            </span>
            <span className="text-base font-bold tracking-tight text-slate-100 sm:text-lg">
              RoadGuard<span className="text-amber-400">AI</span>
            </span>
          </button>

          {/* Workspace switcher */}
          <div className="relative" ref={roleMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowRoleMenu((open) => !open);
                setShowNotifMenu(false);
                setShowUserMenu(false);
              }}
              aria-expanded={showRoleMenu}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
              <span className="hidden capitalize sm:inline">{activeRole}</span>
              <ChevronDown
                className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${showRoleMenu ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {showRoleMenu && (
              <div
                role="menu"
                aria-label="Switch workspace"
                className="absolute left-0 z-50 mt-2 w-64 rounded-xl border border-slate-700/80 bg-slate-900 py-2 text-xs shadow-2xl"
              >
                <div className="mb-1 border-b border-slate-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Switch workspace
                </div>
                {(['citizen', 'worker', 'inspector'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activeRole === role}
                    onClick={() => {
                      onRoleChange(role);
                      setShowRoleMenu(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      activeRole === role
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-700/60 bg-slate-800/50 text-slate-400">
                      {ROLE_META[role].icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{ROLE_META[role].label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{ROLE_META[role].desc}</span>
                    </span>
                    {activeRole === role && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Primary workspace navigation */}
        <nav
          className="hidden items-center gap-1 text-xs font-medium text-slate-400 md:flex"
          aria-label="Primary"
        >
          <button
            type="button"
            onClick={goToPlatform}
            aria-current={activeNavTab === 'landing' ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-800/60 hover:text-slate-100 ${
              activeNavTab === 'landing' ? 'bg-slate-800/60 text-amber-400' : ''
            }`}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Platform
          </button>
          <span className="mx-1 h-4 w-px bg-slate-700/70" aria-hidden="true" />
          {navLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => selectNav(link.id)}
              aria-current={activeNavTab === link.id ? 'page' : undefined}
              className={`rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-800/60 hover:text-slate-100 ${
                activeNavTab === link.id ? 'bg-slate-800/60 font-semibold text-amber-400' : ''
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Live service status */}
          <div
            className="hidden items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 font-mono text-[11px] text-slate-300 sm:flex"
            title={status.title}
          >
            <span className={`h-2 w-2 rounded-full ${status.dot} shadow-sm`} aria-hidden="true" />
            <span>{status.label}</span>
          </div>

          {activeRole === 'citizen' && (
            <button
              type="button"
              onClick={onOpenReportModal}
              className="rg-btn rg-btn-primary hidden h-9 sm:inline-flex"
            >
              <span>+ Report Problem</span>
            </button>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              onClick={() => {
                const next = !showNotifMenu;
                setShowNotifMenu(next);
                setShowRoleMenu(false);
                setShowUserMenu(false);
                if (next) onMarkNotificationsRead();
              }}
              className="rg-icon-btn relative h-9 w-9"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              aria-expanded={showNotifMenu}
              aria-haspopup="menu"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 font-mono text-[10px] font-bold text-slate-950">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div
                role="menu"
                aria-label="Notifications"
                className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700/80 bg-slate-900 p-3 text-xs shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-semibold text-slate-200">Notifications</span>
                  <span className="font-mono text-[11px] capitalize text-slate-400">{activeRole} alerts</span>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pt-2">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-slate-500">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          n.read
                            ? 'border-slate-800/80 bg-slate-950/40 text-slate-400'
                            : 'border-amber-500/30 bg-slate-950 text-slate-200'
                        }`}
                      >
                        <div className="mb-0.5 flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-100">{n.title}</span>
                          <span className="shrink-0 font-mono text-[10px] text-slate-500">{n.timestamp}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowUserMenu((open) => !open);
                setShowRoleMenu(false);
                setShowNotifMenu(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/70 p-1.5 transition-colors hover:border-slate-600"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                {currentUser ? currentUser.name[0] : 'G'}
              </span>
              <span className="hidden max-w-[120px] truncate text-xs font-medium text-slate-200 sm:inline">
                {currentUser ? currentUser.name : 'Guest'}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {showUserMenu && (
              <div
                role="menu"
                aria-label="Account"
                className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-700/80 bg-slate-900 py-2 text-xs shadow-2xl"
              >
                <div className="border-b border-slate-800 px-3 py-2">
                  <div className="truncate font-semibold text-slate-100">
                    {currentUser ? currentUser.name : 'Guest User'}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {currentUser ? currentUser.email : 'Not signed in'}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-300">
                    {ROLE_META[activeRole].label}
                  </div>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeAllMenus();
                    onOpenAuthModal();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{currentUser ? 'Switch user / sign in' : 'Sign in / register'}</span>
                </button>

                {onOpenSettings && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeAllMenus();
                      onOpenSettings();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Municipal settings</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeAllMenus();
                    goToPlatform();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Platform overview</span>
                </button>

                {onSignOut && currentUser && (
                  <div className="mt-1 border-t border-slate-800 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeAllMenus();
                        onSignOut();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-300 transition-colors hover:bg-rose-500/10"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
