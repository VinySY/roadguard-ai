export interface Point {
  x: number;
  y: number;
}

export type PotholeSeverity = 'minor' | 'moderate' | 'high' | 'critical';

export interface PotholePrediction {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  class_id?: number;
  confidence: number;
  points?: Point[];
  area?: number;
  areaRatio?: number;
  severity?: PotholeSeverity;
}

export interface ImageMetadata {
  width: number;
  height: number;
}

export interface DetectionAnalytics {
  totalDetected: number;
  maxConfidence: number;
  damagePercentage: number;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface DetectionResult {
  success?: boolean;
  time?: number;
  image: ImageMetadata;
  predictions: PotholePrediction[];
  analytics?: DetectionAnalytics;
  timestamp?: number;
  sourceName?: string;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  persistence?: {
    saved: boolean;
    inspectionId?: number;
    warning?: string;
  };
}

export interface SampleImage {
  id: string;
  name: string;
  filename: string;
}

export interface ServerHealth {
  status: string;
  apiKeyConfigured: boolean;
  modelReachable?: boolean;
  model?: {
    workspace: string;
    project: string;
    version: string;
    details?: unknown;
  };
}

export type DetectionState =
  | { status: 'idle' }
  | { status: 'image-selected'; file?: File; sampleFilename?: string; preview: string; name?: string }
  | { status: 'detecting'; preview: string; name?: string }
  | { status: 'success'; result: DetectionResult; imagePreview: string }
  | { status: 'no-detections'; result: DetectionResult; imagePreview: string }
  | { status: 'error'; error: string; file?: File; sampleFilename?: string; preview?: string; name?: string };

export type NavigationTab = 
  | 'landing'
  | 'dashboard'
  | 'detect'
  | 'video-detect'
  | 'reports'
  | 'issues'
  | 'map'
  | 'analytics'
  | 'settings';

export interface VideoMetadata {
  filename: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

export interface VideoProcessingInfo {
  extractionFps: number;
  totalFrames: number;
  processedFrames: number;
  failedFrames: number;
}

export interface VideoAnalytics {
  totalDetections: number;
  uniquePotholeCount: number;
  framesWithDetections: number;
  maxConfidence: number;
  avgDamagePercentage: number;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
}

export interface FrameDetectionResult {
  frameIndex: number;
  timestamp: number;
  predictions: PotholePrediction[];
  analytics: {
    totalDetected: number;
    maxConfidence: number;
    damagePercentage: number;
    overallRiskLevel: string;
  };
}

export interface VideoDetectionResponse {
  success: boolean;
  type: 'video';
  video: VideoMetadata;
  processing: VideoProcessingInfo;
  analytics: VideoAnalytics;
  frames: FrameDetectionResult[];
  errors?: { frameIndex: number; error: string }[];
  persistence?: {
    saved: boolean;
    inspectionId?: number;
    warning?: string;
  };
}

export interface VideoDetectOptions {
  confidence?: number;
  iou?: number;
  fps?: number;
  overlap?: number;
}

export type VideoDetectionState =
  | { status: 'idle' }
  | { status: 'video-selected'; file: File; previewUrl: string; name: string; size: number }
  | { status: 'processing'; file: File; previewUrl: string; name: string; progressStage?: string }
  | { status: 'success'; result: VideoDetectionResponse; previewUrl: string; file: File }
  | { status: 'error'; error: string; details?: string; file?: File; previewUrl?: string };


export interface UserComplaint {
  id: string;
  title: string;
  category: 'Pothole' | 'Road Damage' | 'Cracked Road' | 'Waterlogging' | 'Uneven Surface' | 'Missing Road Marking' | 'Other';
  severity: PotholeSeverity;
  location: string;
  description: string;
  photoUrl?: string;
  submittedAt: string;
  status: 'Reported' | 'In Inspection' | 'Scheduled for Repair' | 'Resolved';
}

export interface AppSettings {
  defaultConfidence: number;
  showPolygonsByDefault: boolean;
  showBoundingBoxesByDefault: boolean;
  showLabelsByDefault: boolean;
  highContrastColors: boolean;
}

export interface AnalyticsSummaryResponse {
  totals: {
    totalInspections: number;
    totalDetections: number;
    totalUniquePotholes: number;
    avgDamagePercentage: number;
    totalRoadIssues: number;
    resolvedRoadIssues: number;
    scheduledRoadIssues: number;
    inspectingRoadIssues: number;
    reportedRoadIssues: number;
    resolutionRate: number;
  };
  monthlyTrends: Array<{
    month: string;
    inspections: number;
    detections: number;
  }>;
  riskDistribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  severityDistribution: {
    minor: number;
    moderate: number;
    high: number;
    critical: number;
  };
  issueStatusDistribution: {
    Reported: number;
    'In Inspection': number;
    'Scheduled for Repair': number;
    Resolved: number;
  };
  issueCategoryDistribution: Array<{
    category: string;
    count: number;
  }>;
}
