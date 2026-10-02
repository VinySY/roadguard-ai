export type UserRole = 'citizen' | 'worker' | 'inspector';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  assignedZone?: string;
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type IssueStatus =
  | 'reported'
  | 'notified_municipality'
  | 'inspection_scheduled'
  | 'in_repair'
  | 'resolved';

export interface BoundingBox {
  x: number; // center x (0 to 1) or pixel
  y: number; // center y (0 to 1) or pixel
  width: number;
  height: number;
  confidence: number;
  class: string;
}

export interface DetectionResult {
  potholeCount: number;
  severity: SeverityLevel;
  confidence: number;
  boxes: BoundingBox[];
  imageUrl?: string;
  processedAt: string;
  roadConditionIndex?: number; // 0-100
  recommendedAction?: string;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
  street?: string;
  area?: string;
  city?: string;
  postalCode?: string;
}

export interface TimelineEvent {
  id: string;
  status: IssueStatus;
  title: string;
  timestamp: string;
  description: string;
  actor?: string;
}

export interface InspectionDetails {
  workerId?: string;
  workerName?: string;
  scheduledDate?: string;
  inspectedAt?: string;
  checklist: {
    depthMeasured: boolean;
    trafficSafetyConePlaced: boolean;
    pavementCrackingAssessed: boolean;
    utilityInterferenceChecked: boolean;
    asphaltBatchRequested: boolean;
  };
  notes?: string;
  measurements?: {
    estimatedDepthCm: number;
    estimatedWidthCm: number;
    estimatedLengthCm: number;
  };
  fieldPhotos?: string[];
}

export interface RoadIssue {
  id: string;
  referenceNumber: string; // e.g. RG-2026-4821
  title: string;
  description?: string;
  severity: SeverityLevel;
  status: IssueStatus;
  location: LocationCoordinates;
  municipalityId: string;
  municipalityName: string;
  reportedBy: {
    userId?: string;
    name?: string;
    isGuest?: boolean;
    contactEmail?: string;
    contactPhone?: string;
  };
  createdAt: string;
  updatedAt: string;
  evidenceImageUrl: string;
  evidenceVideoUrl?: string;
  detectionData?: DetectionResult;
  timeline: TimelineEvent[];
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  inspection?: InspectionDetails;
  priorityScore?: number; // 1-100
}

export interface Municipality {
  id: string;
  name: string;
  department: string;
  state: string;
  contactEmail: string;
  helpline: string;
  dispatchZone: string;
  slaHours: number;
  activeWorkersCount: number;
  isConfigurableDemo: boolean;
}

export interface AppNotification {
  id: string;
  role: UserRole | 'all';
  userId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  issueId?: string;
  severity?: SeverityLevel;
  actionUrl?: string;
}

// Re-export Roboflow and Video detection types for unified access
export type {
  Point,
  PotholeSeverity,
  PotholePrediction,
  ImageMetadata,
  DetectionAnalytics,
  SampleImage,
  ServerHealth,
  DetectionState,
  NavigationTab,
  VideoMetadata,
  VideoProcessingInfo,
  VideoAnalytics,
  FrameDetectionResult,
  VideoDetectionResponse,
  VideoDetectOptions,
  AnalyticsSummaryResponse,
  AppSettings,
} from './detection';
