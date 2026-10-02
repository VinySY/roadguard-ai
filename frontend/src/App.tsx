import React, { useState, useEffect } from 'react';
import { User, UserRole, RoadIssue, LocationCoordinates, AppNotification, DetectionResult, ServerHealth } from './types';
import { storage, DEMO_USERS } from './services/storage';
import { getCurrentBrowserLocation } from './services/location';
import { checkServerHealth } from './services/roboflow';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { CustomerDashboard } from './components/customer/CustomerDashboard';
import { CustomerReportsView } from './components/customer/CustomerReportsView';
import { WorkerDashboard } from './components/worker/WorkerDashboard';
import { WorkerTasksView } from './components/worker/WorkerTasksView';
import { InspectorOverview } from './components/inspector/InspectorOverview';
import { RoadIssuesView } from './components/inspector/RoadIssuesView';
import { InspectorAssignments } from './components/inspector/InspectorAssignments';
import { InspectorAnalytics } from './components/inspector/InspectorAnalytics';
import { InspectorReports } from './components/inspector/InspectorReports';
import { DetectionStudio } from './components/detection/DetectionStudio';
import { LeafletMap } from './components/map/LeafletMap';
import { ReportModal } from './components/reporting/ReportModal';
import { AuthModal } from './components/auth/AuthModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { LandingPage } from './components/landing/LandingPage';

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>(storage.getActiveRole());
  const [currentUser, setCurrentUser] = useState<User | null>(storage.getCurrentUser());
  const [currentNav, setCurrentNav] = useState<string>('home');
  const [issues, setIssues] = useState<RoadIssue[]>(storage.getIssues());
  const [notifications, setNotifications] = useState<AppNotification[]>(storage.getNotifications(activeRole));
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(storage.getTheme());
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalInitialDetection, setReportModalInitialDetection] = useState<DetectionResult | null>(null);
  const [reportModalInitialMode, setReportModalInitialMode] = useState<'upload-image' | 'take-photo' | 'upload-video' | 'record-video'>('upload-image');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Initialize theme on mount
  useEffect(() => {
    const initialized = storage.initTheme();
    setCurrentTheme(initialized);
  }, []);

  // Poll server health on mount & periodic interval
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkServerHealth();
        setServerHealth(health);
      } catch {
        setServerHealth(null);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync role and notifications
  useEffect(() => {
    setNotifications(storage.getNotifications(activeRole));
  }, [activeRole]);

  const handleToggleTheme = () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(nextTheme);
    storage.setTheme(nextTheme);
  };

  // Handle role switch
  const handleRoleChange = (newRole: UserRole) => {
    setActiveRole(newRole);
    storage.setActiveRole(newRole);
    const user = DEMO_USERS[newRole];
    setCurrentUser(user);

    // Set default view for role
    if (newRole === 'citizen') setCurrentNav('home');
    else if (newRole === 'worker') setCurrentNav('dashboard');
    else if (newRole === 'inspector') setCurrentNav('overview');
  };

  const handleOpenReportModal = (mode?: 'upload-image' | 'take-photo' | 'upload-video' | 'record-video') => {
    setReportModalInitialDetection(null);
    setReportModalInitialMode(mode || 'upload-image');
    setIsReportModalOpen(true);
  };

  const handleDetectionProceedToReport = (detection: DetectionResult) => {
    setReportModalInitialDetection(detection);
    setIsReportModalOpen(true);
  };

  const handleReportSubmitted = (newIssue: RoadIssue) => {
    setIssues(storage.getIssues());
    setNotifications(storage.getNotifications(activeRole));
  };

  const handleIssueUpdated = (updated: RoadIssue) => {
    setIssues(storage.getIssues());
    setNotifications(storage.getNotifications(activeRole));
  };

  const handleMarkNotificationsRead = () => {
    storage.markNotificationsAsRead(activeRole);
    setNotifications(storage.getNotifications(activeRole));
  };

  const handleOpenIssueDetail = (issue: RoadIssue) => {
    setSelectedIssueId(issue.id);
    if (activeRole === 'citizen') {
      setCurrentNav('reports');
    } else if (activeRole === 'worker') {
      setCurrentNav('tasks');
    } else {
      setCurrentNav('issues');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 3-Zone Header Contract */}
      <Header
        currentUser={currentUser}
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        onOpenReportModal={() => handleOpenReportModal()}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        activeNavTab={currentNav}
        onSelectNavTab={(tab) => setCurrentNav(tab)}
        currentTheme={currentTheme}
        onToggleTheme={handleToggleTheme}
        serverHealth={serverHealth}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-28 lg:pb-8">
        {/* Role-Specific Sidebar */}
        {currentNav !== 'landing' && (
          <Sidebar
            activeRole={activeRole}
            currentNav={currentNav}
            onSelectNav={(nav) => setCurrentNav(nav)}
            onOpenReportModal={() => handleOpenReportModal()}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {/* CITIZEN VIEWS */}
          {activeRole === 'citizen' && (
            <>
              {currentNav === 'home' && (
                <CustomerDashboard
                  currentUser={currentUser}
                  issues={issues}
                  userLocation={userLocation}
                  onOpenReportModal={handleOpenReportModal}
                  onOpenIssueDetails={handleOpenIssueDetail}
                  onNavigateToMap={() => setCurrentNav('map')}
                  onNavigateToMyReports={() => setCurrentNav('reports')}
                  onNavigateToDetection={(mode) => {
                    setCurrentNav('detection');
                  }}
                  onLocationUpdate={(coords) => setUserLocation(coords)}
                />
              )}

              {currentNav === 'detection' && (
                <div className="max-w-5xl mx-auto">
                  <DetectionStudio
                    role="citizen"
                    onProceedToReport={handleDetectionProceedToReport}
                    onViewOnMap={() => setCurrentNav('map')}
                  />
                </div>
              )}

              {currentNav === 'reports' && (
                <CustomerReportsView
                  issues={issues}
                  currentUser={currentUser}
                  onOpenReportModal={() => handleOpenReportModal()}
                  selectedIssueId={selectedIssueId}
                  onCloseDetail={() => setSelectedIssueId(null)}
                />
              )}

              {currentNav === 'map' && (
                <div className="space-y-4 max-w-6xl mx-auto">
                  <div className="pb-3 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-slate-100">Nearby Road Hazards Map</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Explore reported asphalt distress, potholes, and verified repairs in your area.
                    </p>
                  </div>
                  <LeafletMap
                    issues={issues}
                    role="citizen"
                    userLocation={userLocation}
                    onLocationUpdate={(coords) => setUserLocation(coords)}
                    onSelectIssue={handleOpenIssueDetail}
                    height="620px"
                  />
                </div>
              )}
            </>
          )}

          {/* WORKER VIEWS */}
          {activeRole === 'worker' && (
            <>
              {currentNav === 'dashboard' && currentUser && (
                <WorkerDashboard
                  currentUser={currentUser}
                  issues={issues}
                  userLocation={userLocation}
                  onOpenTask={handleOpenIssueDetail}
                  onNavigateToMap={() => setCurrentNav('map')}
                  onNavigateToDetection={() => setCurrentNav('detection')}
                  onLocationUpdate={(coords) => setUserLocation(coords)}
                />
              )}

              {currentNav === 'tasks' && currentUser && (
                <WorkerTasksView
                  issues={issues}
                  currentUser={currentUser}
                  selectedIssueId={selectedIssueId}
                  onClose={() => setSelectedIssueId(null)}
                  onIssueUpdated={handleIssueUpdated}
                />
              )}

              {currentNav === 'map' && (
                <div className="space-y-4 max-w-6xl mx-auto">
                  <div className="pb-3 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-slate-100">Assigned Inspection Route</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Field navigation map showing your assigned road defect sites.
                    </p>
                  </div>
                  <LeafletMap
                    issues={issues}
                    role="worker"
                    workerId={currentUser?.id}
                    userLocation={userLocation}
                    onLocationUpdate={(coords) => setUserLocation(coords)}
                    onSelectIssue={handleOpenIssueDetail}
                    height="620px"
                  />
                </div>
              )}

              {currentNav === 'detection' && (
                <div className="max-w-4xl mx-auto">
                  <DetectionStudio
                    role="worker"
                    onProceedToReport={handleDetectionProceedToReport}
                    onViewOnMap={() => setCurrentNav('map')}
                  />
                </div>
              )}
            </>
          )}

          {/* INSPECTOR VIEWS */}
          {activeRole === 'inspector' && (
            <>
              {currentNav === 'overview' && currentUser && (
                <InspectorOverview
                  currentUser={currentUser}
                  issues={issues}
                  userLocation={userLocation}
                  onOpenIssue={handleOpenIssueDetail}
                  onNavigateToMap={() => setCurrentNav('map')}
                  onNavigateToAssignments={() => setCurrentNav('assignments')}
                  onNavigateToReports={() => setCurrentNav('reports')}
                  onLocationUpdate={(coords) => setUserLocation(coords)}
                />
              )}

              {currentNav === 'issues' && currentUser && (
                <RoadIssuesView
                  issues={issues}
                  currentUser={currentUser}
                  onIssueUpdated={handleIssueUpdated}
                  selectedIssueId={selectedIssueId}
                />
              )}

              {currentNav === 'assignments' && currentUser && (
                <InspectorAssignments
                  issues={issues}
                  currentUser={currentUser}
                  onIssueUpdated={handleIssueUpdated}
                  onOpenIssue={handleOpenIssueDetail}
                />
              )}

              {currentNav === 'map' && (
                <div className="space-y-4 max-w-7xl mx-auto">
                  <div className="pb-3 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-slate-100">Municipal Road Situation Console</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Full citywide geospatial defect monitoring, severity filters, and crew assignment status.
                    </p>
                  </div>
                  <LeafletMap
                    issues={issues}
                    role="inspector"
                    userLocation={userLocation}
                    onLocationUpdate={(coords) => setUserLocation(coords)}
                    onSelectIssue={handleOpenIssueDetail}
                    height="640px"
                  />
                </div>
              )}

              {currentNav === 'reports' && (
                <InspectorReports issues={issues} />
              )}

              {currentNav === 'analytics' && (
                <InspectorAnalytics issues={issues} />
              )}

              {currentNav === 'detection' && (
                <div className="max-w-4xl mx-auto">
                  <DetectionStudio
                    role="inspector"
                    onProceedToReport={handleDetectionProceedToReport}
                    onViewOnMap={() => setCurrentNav('map')}
                  />
                </div>
              )}
            </>
          )}

          {/* LANDING PAGE VIEW */}
          {currentNav === 'landing' && (
            <LandingPage
              onEnterRole={(role) => handleRoleChange(role)}
              onOpenReportModal={() => handleOpenReportModal()}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeRole={activeRole}
        currentNav={currentNav}
        onSelectNav={(nav) => setCurrentNav(nav)}
        onOpenReportModal={() => handleOpenReportModal()}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Citizen Reporting Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentUser={currentUser}
        onReportSubmitted={handleReportSubmitted}
        initialDetection={reportModalInitialDetection}
        userCurrentLocation={userLocation}
        initialMode={reportModalInitialMode}
      />

      {/* Auth & Session Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={(user, role) => {
          setCurrentUser(user);
          handleRoleChange(role);
        }}
      />

      {/* Demo Municipal Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onMunicipalitiesUpdated={() => setIssues(storage.getIssues())}
      />
    </div>
  );
}
