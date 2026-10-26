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
import { PageHeader } from './components/common/PageHeader';
import { MapPin } from 'lucide-react';

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>(storage.getActiveRole());
  const [currentUser, setCurrentUser] = useState<User | null>(storage.getCurrentUser());
  const [currentNav, setCurrentNav] = useState<string>('landing');
  const [issues, setIssues] = useState<RoadIssue[]>(storage.getIssues());
  const [notifications, setNotifications] = useState<AppNotification[]>(storage.getNotifications(activeRole));
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalInitialDetection, setReportModalInitialDetection] = useState<DetectionResult | null>(null);
  const [reportModalInitialMode, setReportModalInitialMode] = useState<'upload-image' | 'take-photo' | 'upload-video' | 'record-video'>('upload-image');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // RoadGuard presents a single Midnight + Amber visual system; keep the
  // document in dark mode regardless of any previously stored preference.
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
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

  const handleStartDetection = () => {
    handleRoleChange('citizen');
    setCurrentNav('detection');
  };

  const handleExploreMap = () => {
    handleRoleChange('citizen');
    setCurrentNav('map');
  };

  const handleGoToLanding = () => {
    setCurrentNav('landing');
  };

  const handleSignOut = () => {
    storage.setCurrentUser(null);
    setCurrentUser(null);
    setSelectedIssueId(null);
    setIsSettingsModalOpen(false);
    setCurrentNav('landing');
  };

  return (
    <div className="rg-app-bg flex h-full w-full flex-col overflow-hidden font-sans text-slate-100">
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
        onGoToLanding={handleGoToLanding}
        onSignOut={handleSignOut}
        serverHealth={serverHealth}
      />

      <div className="relative z-[1] flex w-full flex-1 overflow-hidden">
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
            onGoToLanding={handleGoToLanding}
          />
        )}

        {/* Main Content Viewport — independently scrollable */}
        <main className="rg-main-scroll flex-1 h-full overflow-y-auto overflow-x-hidden min-w-0 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <div className="mx-auto w-full max-w-[1600px]">
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
                <div className="w-full">
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
                <div className="w-full space-y-4">
                  <PageHeader
                    eyebrow={
                      <>
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Citizen road map
                      </>
                    }
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                    title="Nearby road hazards"
                    description="Explore reported asphalt distress, potholes, and verified repairs around you."
                  />
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
                <div className="w-full space-y-4">
                  <PageHeader
                    eyebrow={
                      <>
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Field navigation
                      </>
                    }
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                    title="Assigned inspection route"
                    description="Field navigation map showing the road defect sites assigned to your crew."
                  />
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
                <div className="w-full">
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
                <div className="w-full space-y-4">
                  <PageHeader
                    eyebrow={
                      <>
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Municipal geospatial console
                      </>
                    }
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                    title="Citywide road situation"
                    description="Geospatial defect monitoring with severity filters, status filters, and crew assignment status."
                  />
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
                <div className="w-full">
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
              onStartDetection={handleStartDetection}
              onExploreMap={handleExploreMap}
            />
          )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {currentNav !== 'landing' && (
        <MobileNav
          activeRole={activeRole}
          currentNav={currentNav}
          onSelectNav={(nav) => setCurrentNav(nav)}
          onOpenReportModal={() => handleOpenReportModal()}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}

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
