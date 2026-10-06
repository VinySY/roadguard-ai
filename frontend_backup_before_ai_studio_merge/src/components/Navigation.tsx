import React from 'react';
import { 
  Home, 
  LayoutDashboard, 
  Scan, 
  Video,
  FileText, 
  AlertTriangle, 
  MapPin, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  Play
} from 'lucide-react';
import { NavigationTab, ServerHealth } from '../types/detection';

interface NavigationProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  serverHealth: ServerHealth | null;
  hasActiveDetection: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  serverHealth,
  hasActiveDetection,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'landing', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'detect', label: 'AI Detection', icon: <Scan className="w-4 h-4" />, badge: hasActiveDetection ? 'ACTIVE' : undefined },
    { id: 'video-detect', label: 'Video Analysis', icon: <Video className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'issues', label: 'Road Issues', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'map', label: 'Road Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];


  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const getStatusInfo = () => {
    if (!serverHealth) {
      return {
        label: 'Backend Offline',
        color: 'bg-rose-500',
        glow: 'shadow-rose-500/40',
        title: 'Backend server not responding on port 3001'
      };
    }
    if (serverHealth.modelReachable) {
      return {
        label: 'YOLOv11 Online',
        color: 'bg-emerald-500',
        glow: 'shadow-emerald-500/40',
        title: 'Roboflow YOLOv11 segmentation model ready'
      };
    }
    if (serverHealth.apiKeyConfigured) {
      return {
        label: 'API Key Active',
        color: 'bg-amber-500',
        glow: 'shadow-amber-500/40',
        title: 'Roboflow key configured, checking inference endpoint'
      };
    }
    return {
      label: 'Key Missing',
      color: 'bg-amber-400',
      glow: 'shadow-amber-400/40',
      title: 'ROBOFLOW_API_KEY required in backend .env'
    };
  };

  const status = getStatusInfo();

  return (
    <>
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-50 h-16 bg-[#090D16]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            onClick={() => handleNavClick('landing')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Scan className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">
              ROADGUARD <span className="text-amber-500 font-black">AI</span>
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions & Real Health Indicator */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono"
            title={status.title}
          >
            <span className={`w-2 h-2 rounded-full ${status.color} shadow-sm ${status.glow}`} />
            <span className="hidden sm:inline text-slate-300">{status.label}</span>
          </div>

          {currentTab !== 'detect' && (
            <button
              onClick={() => handleNavClick('detect')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-500/20 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Studio</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="w-72 max-w-[85vw] h-full bg-slate-950 border-r border-slate-800 p-6 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                  <Scan className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="text-base font-bold text-white tracking-tight">
                  ROADGUARD <span className="text-amber-500">AI</span>
                </span>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
              <p>Model Engine: Roboflow YOLOv11</p>
              <p className="mt-1">Pavement Segmentation Service</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
