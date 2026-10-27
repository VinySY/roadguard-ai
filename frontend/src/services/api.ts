import { Point, VideoDetectOptions, VideoDetectionResponse, AnalyticsSummaryResponse } from '../types/detection';
import { getApiUrl } from '../config/api';

export interface InspectionRecord {
  id: number;
  image_filename: string;
  image_path: string | null;
  image_url?: string | null;
  video_path?: string | null;
  video_url?: string | null;
  media_type?: 'image' | 'video' | string | null;
  detection_metadata?: unknown;
  image_width: number;
  image_height: number;
  detection_count: number;
  unique_pothole_count?: number | null;
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  damage_percentage: number | string;
  confidence_threshold: number;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

export interface DetectionRecord {
  id: number;
  inspection_id: number;
  class_name: string;
  confidence: number | string;
  severity: 'minor' | 'moderate' | 'high' | 'critical';
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  polygon_points: Point[] | null;
  created_at: string;
}

export interface InspectionsResponse {
  inspections: InspectionRecord[];
  total: number;
}

export interface InspectionDetailResponse {
  inspection_id: number;
  detections: DetectionRecord[];
}

export interface RoadIssueRecord {
  id: number;
  category: 'Pothole' | 'Road Damage' | 'Cracked Road' | 'Waterlogging' | 'Uneven Surface' | 'Missing Road Marking' | 'Other';
  description: string;
  latitude: number | null;
  longitude: number | null;
  severity: 'minor' | 'moderate' | 'high' | 'critical';
  status: 'Reported' | 'In Inspection' | 'Scheduled for Repair' | 'Resolved';
  media_type?: 'image' | 'video' | string | null;
  evidence_path: string | null;
  evidence_url?: string | null;
  evidence_video_path?: string | null;
  evidence_video_url?: string | null;
  detection_metadata?: unknown;
  created_at: string;
  updated_at: string;
}

export interface RoadIssuesResponse {
  issues: RoadIssueRecord[];
  total: number;
}

export interface CreateRoadIssuePayload {
  category: string;
  description: string;
  severity: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  media_type?: 'image' | 'video';
  evidence_path?: string | null;
  evidence_video_path?: string | null;
  detection_metadata?: unknown;
  evidenceFile?: File | Blob | null;
}

/**
 * Fetch paginated inspections from MySQL backend.
 */
export async function fetchInspections(limit = 50, offset = 0): Promise<InspectionsResponse> {
  const res = await fetch(getApiUrl(`/api/inspections?limit=${limit}&offset=${offset}`));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Fetch single inspection by ID.
 */
export async function fetchInspectionById(id: number): Promise<InspectionRecord> {
  const res = await fetch(getApiUrl(`/api/inspections/${id}`));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Fetch detection items for a specific inspection.
 */
export async function fetchInspectionDetections(id: number): Promise<InspectionDetailResponse> {
  const res = await fetch(getApiUrl(`/api/inspections/${id}/detections`));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Fetch road issues from MySQL backend.
 */
export async function fetchRoadIssues(status?: string, limit = 50, offset = 0): Promise<RoadIssuesResponse> {
  const query = new URLSearchParams();
  query.set('limit', limit.toString());
  query.set('offset', offset.toString());
  if (status && status !== 'ALL') {
    query.set('status', status);
  }

  const res = await fetch(getApiUrl(`/api/issues?${query.toString()}`));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Create a new road issue in MySQL.
 */
export async function createRoadIssue(payload: CreateRoadIssuePayload): Promise<RoadIssueRecord> {
  const hasFile = Boolean(payload.evidenceFile);
  let res: Response;

  if (hasFile && payload.evidenceFile) {
    const formData = new FormData();
    formData.append('category', payload.category);
    formData.append('description', payload.description);
    formData.append('severity', payload.severity);
    if (payload.status) formData.append('status', payload.status);
    if (payload.latitude != null) formData.append('latitude', String(payload.latitude));
    if (payload.longitude != null) formData.append('longitude', String(payload.longitude));
    if (payload.media_type) formData.append('media_type', payload.media_type);
    if (payload.evidence_path) formData.append('evidence_path', payload.evidence_path);
    if (payload.evidence_video_path) formData.append('evidence_video_path', payload.evidence_video_path);
    if (payload.detection_metadata !== undefined && payload.detection_metadata !== null) {
      formData.append('detection_metadata', JSON.stringify(payload.detection_metadata));
    }
    const fileName = payload.evidenceFile instanceof File ? payload.evidenceFile.name : 'complaint.jpg';
    formData.append('evidence', payload.evidenceFile, fileName);
    res = await fetch(getApiUrl('/api/issues'), {
      method: 'POST',
      body: formData,
    });
  } else {
    const { evidenceFile: _ignored, ...jsonPayload } = payload;
    res = await fetch(getApiUrl('/api/issues'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonPayload),
    });
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details?.join(', ') || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Update the status of an existing road issue in MySQL.
 */
export async function updateRoadIssueStatus(id: number, status: string): Promise<RoadIssueRecord> {
  const res = await fetch(getApiUrl(`/api/issues/${id}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}

/**
 * Upload and run pothole detection and tracking on a video file.
 * Calls POST /api/detect/video with multipart FormData.
 */
export async function detectVideo(
  file: File,
  options: VideoDetectOptions = {}
): Promise<VideoDetectionResponse> {
  const formData = new FormData();
  formData.append('video', file);

  const queryParams = new URLSearchParams();
  if (options.confidence !== undefined) {
    queryParams.set('confidence', Math.round(options.confidence).toString());
  }
  if (options.iou !== undefined) {
    queryParams.set('iou', options.iou.toString());
  }
  if (options.fps !== undefined) {
    queryParams.set('fps', options.fps.toString());
  }
  if (options.overlap !== undefined) {
    queryParams.set('overlap', options.overlap.toString());
  }

  const queryString = queryParams.toString();
  const url = getApiUrl(`/api/detect/video${queryString ? `?${queryString}` : ''}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Failed to reach video detection backend at ${url}. Please ensure the RoadGuard backend is running: ${errorMsg}`);
  }

  if (!response.ok) {
    let errorDetails = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetails = errJson.error || errJson.details || errJson.message || errorDetails;
    } catch {
      // not json
    }
    throw new Error(errorDetails);
  }

  const data: VideoDetectionResponse = await response.json();
  return data;
}

/**
 * Fetch historical analytics summary from MySQL backend.
 */
export async function fetchAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
  const res = await fetch(getApiUrl('/api/analytics/summary'));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.error || err.details || msg;
    } catch {
      // not json
    }
    throw new Error(msg);
  }
  return await res.json();
}


