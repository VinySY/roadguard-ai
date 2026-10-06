import { RoadIssue, Municipality, AppNotification, User, UserRole } from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'roadguard_current_user',
  ROLE: 'roadguard_active_role',
  ISSUES: 'roadguard_issues_v2',
  MUNICIPALITIES: 'roadguard_municipalities_v2',
  NOTIFICATIONS: 'roadguard_notifications_v2',
  USER_LOCATION: 'roadguard_cached_location',
};

export const DEFAULT_MUNICIPALITIES: Municipality[] = [
  {
    id: 'muni-1',
    name: 'Municipal Corporation Chandigarh (MCC)',
    department: 'Roads & Infrastructure Engineering Wing',
    state: 'Chandigarh UT',
    contactEmail: 'roads.dispatch@mcc-demo.gov.in',
    helpline: '+91 172 2787200',
    dispatchZone: 'North Urban Zone 1 (Sector 1 to 28)',
    slaHours: 24,
    activeWorkersCount: 14,
    isConfigurableDemo: true,
  },
  {
    id: 'muni-2',
    name: 'Greater Mohali Area Development Authority (GMADA)',
    department: 'Civil Maintenance & Pavement Division',
    state: 'Punjab',
    contactEmail: 'infrastructure@gmada-demo.punjab.gov.in',
    helpline: '+91 172 2215308',
    dispatchZone: 'Mohali Urban & Highway Corridor',
    slaHours: 48,
    activeWorkersCount: 9,
    isConfigurableDemo: true,
  },
  {
    id: 'muni-3',
    name: 'Panchkula Municipal Corporation',
    department: 'Public Works & Asphalt Maintenance',
    state: 'Haryana',
    contactEmail: 'potholes.cell@mcpanchkula-demo.haryana.gov.in',
    helpline: '+91 172 2583642',
    dispatchZone: 'Panchkula Urban & Bypass',
    slaHours: 36,
    activeWorkersCount: 8,
    isConfigurableDemo: true,
  },
  {
    id: 'muni-4',
    name: 'National Highways Authority of India (NHAI Regional)',
    department: 'Highway Safety & Pavement Inspection Cell',
    state: 'Northern Region',
    contactEmail: 'highway.sos@nhai-demo.gov.in',
    helpline: '1033 (Toll Free)',
    dispatchZone: 'NH-5 / Express Highway Section',
    slaHours: 12,
    activeWorkersCount: 22,
    isConfigurableDemo: true,
  },
];

export const DEMO_USERS: Record<UserRole, User> = {
  citizen: {
    id: 'user-cit-01',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    role: 'citizen',
    assignedZone: 'Sector 17 / Central',
  },
  worker: {
    id: 'user-wrk-01',
    name: 'Ramesh Kumar',
    email: 'ramesh.k@mcc-demo.gov.in',
    role: 'worker',
    department: 'MCC Quick Response Asphalt Crew 3',
    assignedZone: 'Sector 17 & Sector 22 Corridor',
  },
  inspector: {
    id: 'user-insp-01',
    name: 'Divya Singhal, P.E.',
    email: 'divya.singhal@mcc-demo.gov.in',
    role: 'inspector',
    department: 'Chief Municipal Pavement Inspector',
    assignedZone: 'All Municipal Sectors',
  },
};

const INITIAL_ISSUES: RoadIssue[] = [
  {
    id: 'issue-001',
    referenceNumber: 'RG-2026-9041',
    title: 'Severe Cavity on Main Carriage Lane',
    description: 'Deep road cavity in right wheel path near traffic junction. Sharp edges posing severe hazard to two-wheelers and buses.',
    severity: 'critical',
    status: 'in_repair',
    location: {
      lat: 30.7398,
      lng: 76.7827,
      street: 'Jan Marg, Opposite Sector 17 Plaza',
      area: 'Sector 17',
      city: 'Chandigarh',
      postalCode: '160017',
    },
    municipalityId: 'muni-1',
    municipalityName: 'Municipal Corporation Chandigarh (MCC)',
    reportedBy: {
      userId: 'user-cit-01',
      name: 'Aarav Sharma',
      contactEmail: 'aarav.sharma@example.com',
    },
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    evidenceImageUrl: '/src/assets/images/roadguard_pothole_evidence_1790958622590.jpg',
    priorityScore: 94,
    assignedWorkerId: 'user-wrk-01',
    assignedWorkerName: 'Ramesh Kumar',
    detectionData: {
      potholeCount: 2,
      severity: 'critical',
      confidence: 0.94,
      boxes: [
        { x: 0.48, y: 0.62, width: 0.38, height: 0.28, confidence: 0.96, class: 'Severe Pothole' },
        { x: 0.22, y: 0.44, width: 0.18, height: 0.14, confidence: 0.88, class: 'Asphalt Depression' },
      ],
      processedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      roadConditionIndex: 38,
      recommendedAction: 'Immediate cold-mix patch required prior to evening transit peak',
    },
    timeline: [
      {
        id: 'tl-1',
        status: 'reported',
        title: 'Report Submitted',
        timestamp: new Date(Date.now() - 36 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Oct 1',
        description: 'Citizen report logged with high-resolution photo evidence and GPS coordinates.',
        actor: 'Aarav Sharma (Citizen)',
      },
      {
        id: 'tl-2',
        status: 'notified_municipality',
        title: 'Municipality Notified',
        timestamp: new Date(Date.now() - 35 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Oct 1',
        description: 'Auto-dispatched via Municipal Highway Desk to MCC Engineering Wing.',
        actor: 'RoadGuard Dispatch Engine',
      },
      {
        id: 'tl-3',
        status: 'inspection_scheduled',
        title: 'Field Inspection Completed',
        timestamp: new Date(Date.now() - 20 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Oct 1',
        description: 'Site visited by Crew 3. Verified depth at 9.2 cm. Traffic cones deployed.',
        actor: 'Ramesh Kumar (Worker)',
      },
      {
        id: 'tl-4',
        status: 'in_repair',
        title: 'Asphalt Patch in Progress',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        description: 'Crew on site. Cold-mix asphalt leveling and compactor application underway.',
        actor: 'Ramesh Kumar (Worker)',
      },
    ],
    inspection: {
      workerId: 'user-wrk-01',
      workerName: 'Ramesh Kumar',
      scheduledDate: '2026-10-02',
      inspectedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      checklist: {
        depthMeasured: true,
        trafficSafetyConePlaced: true,
        pavementCrackingAssessed: true,
        utilityInterferenceChecked: true,
        asphaltBatchRequested: true,
      },
      notes: 'Pavement depth measured at ~9.2cm. Immediate milling and patch applied.',
      measurements: {
        estimatedDepthCm: 9.2,
        estimatedWidthCm: 65,
        estimatedLengthCm: 85,
      },
    },
  },
  {
    id: 'issue-002',
    referenceNumber: 'RG-2026-9042',
    title: 'Multiple Surface Fractures & Pothole Cluster',
    description: 'Cluster of 3 potholes developing after recent monsoon rains near roundabout.',
    severity: 'high',
    status: 'inspection_scheduled',
    location: {
      lat: 30.7245,
      lng: 76.7712,
      street: 'Madhya Marg, Sector 22 Road Link',
      area: 'Sector 22',
      city: 'Chandigarh',
      postalCode: '160022',
    },
    municipalityId: 'muni-1',
    municipalityName: 'Municipal Corporation Chandigarh (MCC)',
    reportedBy: {
      userId: 'user-cit-01',
      name: 'Aarav Sharma',
      contactEmail: 'aarav.sharma@example.com',
    },
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    evidenceImageUrl: '/src/assets/images/roadguard_pothole_evidence_1790958622590.jpg',
    priorityScore: 78,
    assignedWorkerId: 'user-wrk-01',
    assignedWorkerName: 'Ramesh Kumar',
    detectionData: {
      potholeCount: 3,
      severity: 'high',
      confidence: 0.91,
      boxes: [
        { x: 0.35, y: 0.55, width: 0.25, height: 0.2, confidence: 0.92, class: 'Pothole' },
        { x: 0.65, y: 0.48, width: 0.18, height: 0.15, confidence: 0.89, class: 'Pothole' },
      ],
      processedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      roadConditionIndex: 52,
    },
    timeline: [
      {
        id: 'tl-21',
        status: 'reported',
        title: 'Report Submitted',
        timestamp: new Date(Date.now() - 18 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Yesterday',
        description: 'Report filed by citizen Aarav Sharma.',
      },
      {
        id: 'tl-22',
        status: 'notified_municipality',
        title: 'Municipality Notified',
        timestamp: new Date(Date.now() - 17 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Yesterday',
        description: 'Sent to MCC Roads & Infrastructure Division.',
      },
      {
        id: 'tl-23',
        status: 'inspection_scheduled',
        title: 'Inspection Scheduled',
        timestamp: new Date(Date.now() - 6 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        description: 'Assigned to Field Crew 3 (Ramesh Kumar) for on-site assessment.',
      },
    ],
    inspection: {
      workerId: 'user-wrk-01',
      workerName: 'Ramesh Kumar',
      scheduledDate: '2026-10-02',
      checklist: {
        depthMeasured: false,
        trafficSafetyConePlaced: false,
        pavementCrackingAssessed: false,
        utilityInterferenceChecked: false,
        asphaltBatchRequested: false,
      },
      notes: 'Scheduled for morning field route.',
    },
  },
  {
    id: 'issue-003',
    referenceNumber: 'RG-2026-9043',
    title: 'Edge Erosion on Airport Service Road',
    description: 'Pavement shoulder crumble creating a 12cm drop-off on outer lane.',
    severity: 'medium',
    status: 'notified_municipality',
    location: {
      lat: 30.6728,
      lng: 76.7981,
      street: 'International Airport Road, Sector 82',
      area: 'Airport Belt',
      city: 'Mohali',
      postalCode: '140306',
    },
    municipalityId: 'muni-2',
    municipalityName: 'Greater Mohali Area Development Authority (GMADA)',
    reportedBy: {
      isGuest: true,
      name: 'Anonymous Motorist',
      contactPhone: '+91 98888 12345',
    },
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    evidenceImageUrl: '/src/assets/images/roadguard_hero_inspection_1790958611333.jpg',
    priorityScore: 62,
    detectionData: {
      potholeCount: 1,
      severity: 'medium',
      confidence: 0.86,
      boxes: [{ x: 0.5, y: 0.5, width: 0.3, height: 0.25, confidence: 0.86, class: 'Shoulder Erosion' }],
      processedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      roadConditionIndex: 68,
    },
    timeline: [
      {
        id: 'tl-31',
        status: 'reported',
        title: 'Report Submitted',
        timestamp: new Date(Date.now() - 8 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        description: 'Report submitted by guest citizen with photo capture.',
      },
      {
        id: 'tl-32',
        status: 'notified_municipality',
        title: 'Municipality Notified',
        timestamp: new Date(Date.now() - 8 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Today',
        description: 'Forwarded to GMADA Civil Maintenance division.',
      },
    ],
  },
  {
    id: 'issue-004',
    referenceNumber: 'RG-2026-9039',
    title: 'Deep Depression Restored on Dakshin Marg',
    description: 'Recurrent pothole after heavy rain near Sector 35 roundabout.',
    severity: 'high',
    status: 'resolved',
    location: {
      lat: 30.7208,
      lng: 76.7592,
      street: 'Dakshin Marg, Sector 35 Crossing',
      area: 'Sector 35',
      city: 'Chandigarh',
      postalCode: '160035',
    },
    municipalityId: 'muni-1',
    municipalityName: 'Municipal Corporation Chandigarh (MCC)',
    reportedBy: {
      userId: 'user-cit-01',
      name: 'Aarav Sharma',
      contactEmail: 'aarav.sharma@example.com',
    },
    createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    evidenceImageUrl: '/src/assets/images/roadguard_pothole_evidence_1790958622590.jpg',
    priorityScore: 85,
    assignedWorkerId: 'user-wrk-01',
    assignedWorkerName: 'Ramesh Kumar',
    timeline: [
      {
        id: 'tl-41',
        status: 'reported',
        title: 'Report Submitted',
        timestamp: 'Sep 29 · 09:15 AM',
        description: 'Submitted by citizen.',
      },
      {
        id: 'tl-42',
        status: 'notified_municipality',
        title: 'Municipality Notified',
        timestamp: 'Sep 29 · 09:18 AM',
        description: 'Auto-dispatched to MCC.',
      },
      {
        id: 'tl-43',
        status: 'inspection_scheduled',
        title: 'Inspection Completed',
        timestamp: 'Sep 30 · 11:30 AM',
        description: 'Crew marked for fast-track compaction.',
      },
      {
        id: 'tl-44',
        status: 'in_repair',
        title: 'Asphalt Surfacing',
        timestamp: 'Oct 1 · 02:00 PM',
        description: 'Bituminous hot mix installed.',
      },
      {
        id: 'tl-45',
        status: 'resolved',
        title: 'Resolved & Quality Certified',
        timestamp: 'Oct 1 · 06:45 PM',
        description: 'Inspector Divya Singhal signed off on smooth rideability.',
      },
    ],
  },
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    role: 'citizen',
    userId: 'user-cit-01',
    title: 'Repair Underway',
    message: 'Work crew is now on site fixing your reported pothole at Jan Marg (RG-2026-9041).',
    timestamp: '4 hours ago',
    read: false,
    issueId: 'issue-001',
    severity: 'critical',
  },
  {
    id: 'notif-2',
    role: 'citizen',
    userId: 'user-cit-01',
    title: 'Issue Resolved',
    message: 'Pothole on Dakshin Marg (RG-2026-9039) has been patched and inspected.',
    timestamp: '12 hours ago',
    read: true,
    issueId: 'issue-004',
  },
  {
    id: 'notif-3',
    role: 'worker',
    userId: 'user-wrk-01',
    title: 'High Priority Task Assigned',
    message: 'New road issue assigned: Madhya Marg Sector 22 (RG-2026-9042). Field inspection due today.',
    timestamp: '6 hours ago',
    read: false,
    issueId: 'issue-002',
    severity: 'high',
  },
  {
    id: 'notif-4',
    role: 'worker',
    userId: 'user-wrk-01',
    title: 'Asphalt Batch Ready',
    message: 'Hot-mix dispatch #44 ready at Municipal Plant for Sector 17 remediation.',
    timestamp: '5 hours ago',
    read: true,
  },
  {
    id: 'notif-5',
    role: 'inspector',
    userId: 'user-insp-01',
    title: 'Critical Severity Pothole Dispatched',
    message: 'Jan Marg (RG-2026-9041) severity 94 priority confirmed. Repair crew active.',
    timestamp: '4 hours ago',
    read: false,
    issueId: 'issue-001',
    severity: 'critical',
  },
  {
    id: 'notif-6',
    role: 'inspector',
    userId: 'user-insp-01',
    title: 'Daily Municipal SLA Report',
    message: '3 of 4 road issues currently meeting municipal response target of <24h.',
    timestamp: '1 day ago',
    read: true,
  },
];

export const storage = {
  getActiveRole(): UserRole {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    if (saved === 'citizen' || saved === 'worker' || saved === 'inspector') {
      return saved;
    }
    return 'citizen';
  },

  setActiveRole(role: UserRole) {
    localStorage.setItem(STORAGE_KEYS.ROLE, role);
    const user = DEMO_USERS[role];
    this.setCurrentUser(user);
  },

  getCurrentUser(): User {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse current user', e);
      }
    }
    const role = this.getActiveRole();
    return DEMO_USERS[role];
  },

  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  getIssues(): RoadIssue[] {
    const saved = localStorage.getItem(STORAGE_KEYS.ISSUES);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse issues', e);
      }
    }
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(INITIAL_ISSUES));
    return INITIAL_ISSUES;
  },

  saveIssue(issue: RoadIssue): RoadIssue {
    const issues = this.getIssues();
    const index = issues.findIndex((i) => i.id === issue.id);
    let updated: RoadIssue[];
    if (index >= 0) {
      updated = [...issues];
      updated[index] = { ...issue, updatedAt: new Date().toISOString() };
    } else {
      updated = [issue, ...issues];
    }
    localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(updated));
    return issue;
  },

  updateIssueStatus(
    issueId: string,
    status: RoadIssue['status'],
    actorName: string,
    notes?: string
  ): RoadIssue | null {
    const issues = this.getIssues();
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return null;

    const titles: Record<RoadIssue['status'], string> = {
      reported: 'Report Logged',
      notified_municipality: 'Municipality Alerted',
      inspection_scheduled: 'Field Inspection Scheduled',
      in_repair: 'Repair Underway',
      resolved: 'Issue Resolved & Certified',
    };

    const newEvent: RoadIssue['timeline'][0] = {
      id: 'tl-' + Date.now(),
      status,
      title: titles[status],
      timestamp: 'Just now',
      description: notes || `Status updated to ${titles[status]}.`,
      actor: actorName,
    };

    issue.status = status;
    issue.updatedAt = new Date().toISOString();
    issue.timeline.push(newEvent);

    this.saveIssue(issue);

    // Also add notification for relevant actors
    this.addNotification({
      role: 'all',
      title: `${issue.referenceNumber} Updated`,
      message: `${titles[status]} at ${issue.location.street || issue.location.area || 'site'}.`,
      issueId: issue.id,
      severity: issue.severity,
    });

    return issue;
  },

  assignWorkerToIssue(issueId: string, workerId: string, workerName: string): RoadIssue | null {
    const issues = this.getIssues();
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return null;

    issue.assignedWorkerId = workerId;
    issue.assignedWorkerName = workerName;
    if (issue.status === 'reported' || issue.status === 'notified_municipality') {
      issue.status = 'inspection_scheduled';
    }

    issue.timeline.push({
      id: 'tl-' + Date.now(),
      status: 'inspection_scheduled',
      title: 'Task Assigned',
      timestamp: 'Just now',
      description: `Assigned to field technician ${workerName}.`,
      actor: 'Municipal Inspector Desk',
    });

    this.saveIssue(issue);

    this.addNotification({
      role: 'worker',
      userId: workerId,
      title: 'New Field Task Assigned',
      message: `You have been assigned to ${issue.referenceNumber} at ${issue.location.street || issue.location.area}.`,
      issueId: issue.id,
      severity: issue.severity,
    });

    return issue;
  },

  getMunicipalities(): Municipality[] {
    const saved = localStorage.getItem(STORAGE_KEYS.MUNICIPALITIES);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse municipalities', e);
      }
    }
    localStorage.setItem(STORAGE_KEYS.MUNICIPALITIES, JSON.stringify(DEFAULT_MUNICIPALITIES));
    return DEFAULT_MUNICIPALITIES;
  },

  saveMunicipality(muni: Municipality): Municipality {
    const list = this.getMunicipalities();
    const idx = list.findIndex((m) => m.id === muni.id);
    let updated: Municipality[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = muni;
    } else {
      updated = [...list, muni];
    }
    localStorage.setItem(STORAGE_KEYS.MUNICIPALITIES, JSON.stringify(updated));
    return muni;
  },

  getNotifications(role?: UserRole): AppNotification[] {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    let all: AppNotification[] = [];
    if (saved) {
      try {
        all = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    } else {
      all = INITIAL_NOTIFICATIONS;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
    }

    if (!role) return all;
    return all.filter((n) => n.role === 'all' || n.role === role);
  },

  addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
    const all = this.getNotifications();
    const newNotif: AppNotification = {
      ...notif,
      id: 'notif-' + Date.now(),
      timestamp: 'Just now',
      read: false,
    };
    const updated = [newNotif, ...all];
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
    return newNotif;
  },

  markNotificationsAsRead(role?: UserRole) {
    const all = this.getNotifications();
    const updated = all.map((n) => {
      if (!role || n.role === 'all' || n.role === role) {
        return { ...n, read: true };
      }
      return n;
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
  },

  getTheme(): 'dark' | 'light' {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('roadguard_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return 'dark'; // default to RoadGuard's signature dark aesthetic
  },

  setTheme(theme: 'dark' | 'light') {
    if (typeof window === 'undefined') return;
    localStorage.setItem('roadguard_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  },
};
