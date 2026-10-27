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
  /** Stable cross-frame identity assigned by the tracker. */
  trackId?: string;
  trackHits?: number;
  trackConfirmed?: boolean;
}

export interface ImageMetadata {
  width: number;
  height: number;
}

export interface DetectionAnalytics {
  /** Unique, user-facing count. */
  totalDetected: number;
  uniquePotholeCount?: number;
  rawDetectionCount?: number;
  rawTotalDetected?: number;
  rawPredictionCount?: number;
  candidateDetectionCount?: number;
  duplicatePredictionsRemoved?: number;
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
    /** Deployed model ID actually used for inference. */
    modelId?: string;
    /** Roboflow task type, e.g. instance-segmentation. */
    taskType?: string;
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
  /** Durable URL of the stored source video, when the backend retained it. */
  url?: string;
  /** Durable stored path, e.g. uploads/videos/123_clip.mp4. */
  path?: string;
}

export interface VideoProcessingInfo {
  extractionFps: number;
  totalFrames: number;
  processedFrames: number;
  failedFrames: number;
  maxFrames?: number;
  frameLimit?: number;
  estimatedFrames?: number;
  truncated?: boolean;
}

export interface VideoAnalytics {
  /** Raw frame-level detections before cross-frame tracking (debug/audit). */
  totalDetections: number;
  /** Final unique pothole count. */
  uniquePotholeCount: number;
  /** Alias of uniquePotholeCount for consistency with the image endpoint. */
  totalDetected?: number;
  rawDetectionCount?: number;
  rawPredictionCount?: number;
  candidateDetectionCount?: number;
  frameDetectionCount?: number;
  duplicatePredictionsRemoved?: number;
  confirmedPotholeCount?: number;
  tentativePotholeCount?: number;
  totalTracks?: number;
  framesWithDetections: number;
  maxConfidence: number;
  avgDamagePercentage: number;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  worstFrameRiskLevel?: string;
}

export interface VideoTrackingParameters {
  matchIouThreshold: number;
  maxCenterDistanceFactor: number;
  maxMissedFrames: number;
  minHits: number;
  minScaleRatio: number;
  maxScaleRatio: number;
  maskIouThreshold: number;
  resolvedMinHits: number;
}

export interface VideoTrackSummary {
  trackId: string;
  hits: number;
  missed: number;
  confirmed: boolean;
  firstFrameIndex: number;
  lastFrameIndex: number;
  firstTimestamp: number;
  lastTimestamp: number;
  averageConfidence: number;
  maxConfidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface VideoQuality {
  level: 'high' | 'medium' | 'low';
  reasons: string[];
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
  /** Backwards-compatible aliases for the retained source video. */
  videoUrl?: string;
  videoPath?: string;
  processing: VideoProcessingInfo;
  analytics: VideoAnalytics;
  frames: FrameDetectionResult[];
  /** One representative detection per confirmed unique pothole. */
  uniqueDetections?: PotholePrediction[];
  tracking?: {
    parameters: VideoTrackingParameters;
    confirmedTracks: VideoTrackSummary[];
    tentativeTracks: VideoTrackSummary[];
  };
  quality?: VideoQuality;
  limitations?: string[];
  warnings?: string[];
  errors?: { frameIndex: number; error: string }[];
  persistence?: {
    saved: boolean;
    inspectionId?: number;
    warning?: string;
    videoUrl?: string;
    videoPath?: string;
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
