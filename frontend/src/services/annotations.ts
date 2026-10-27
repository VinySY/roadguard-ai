import type {
  BoundingBox,
  DetectionResult,
  SeverityLevel,
  VideoFrameDetection,
} from '../types';

/**
 * Pure helpers that turn persisted detector output into renderable annotation
 * geometry. They intentionally do not invent boxes or timestamps: callers get
 * an empty list when the stored data does not contain real detections.
 */

export interface StoredDetectionLike {
  class_name?: string | null;
  confidence?: number | string | null;
  severity?: string | null;
  x?: number | string | null;
  y?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  polygon_points?: unknown;
}

export interface StoredInspectionLike {
  image_width?: number | null;
  image_height?: number | null;
  overall_risk?: string | null;
  detection_count?: number | null;
  unique_pothole_count?: number | null;
  confidence_threshold?: number | null;
  created_at?: string | null;
  media_type?: string | null;
  detection_metadata?: unknown;
}

function finite(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

export function normalizeSeverity(value?: string | null): SeverityLevel {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'moderate' || normalized === 'medium') return 'medium';
  return 'low';
}

export function severityFromRisk(value?: string | null): SeverityLevel {
  const normalized = (value || '').toUpperCase();
  if (normalized === 'CRITICAL') return 'critical';
  if (normalized === 'HIGH') return 'high';
  if (normalized === 'MEDIUM') return 'medium';
  return 'low';
}

function parsePoints(value: unknown): { x: number; y: number }[] | null {
  if (!Array.isArray(value)) return null;
  const points = value
    .map((point) => {
      if (!point || typeof point !== 'object') return null;
      const x = finite((point as { x?: unknown }).x);
      const y = finite((point as { y?: unknown }).y);
      return x === null || y === null ? null : { x, y };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
  return points.length >= 3 ? points : null;
}

/**
 * Converts MySQL detection rows (Roboflow centre-based pixel coordinates) into
 * the normalised top-left boxes used by the UI overlay. Missing/invalid rows
 * are skipped rather than being replaced with fake geometry.
 */
export function boxesFromStoredDetections(
  detections: StoredDetectionLike[] | null | undefined,
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined
): BoundingBox[] {
  const width = finite(imageWidth);
  const height = finite(imageHeight);
  if (!detections || !width || !height || width <= 0 || height <= 0) {
    return [];
  }

  return detections.flatMap((detection, index) => {
    const x = finite(detection.x);
    const y = finite(detection.y);
    const boxWidth = finite(detection.width);
    const boxHeight = finite(detection.height);
    const confidence = finite(detection.confidence);
    if (x === null || y === null || boxWidth === null || boxHeight === null) return [];
    if (boxWidth <= 0 || boxHeight <= 0) return [];

    const leftPx = x - boxWidth / 2;
    const topPx = y - boxHeight / 2;

    return [
      {
        id: `stored-${index + 1}`,
        x: Math.max(0, Math.min(1, leftPx / width)),
        y: Math.max(0, Math.min(1, topPx / height)),
        width: Math.max(0, Math.min(1, boxWidth / width)),
        height: Math.max(0, Math.min(1, boxHeight / height)),
        confidence: confidence ?? 0,
        class: detection.class_name || 'pothole',
        severity: normalizeSeverity(detection.severity),
        points: parsePoints(detection.polygon_points),
        rawX: x,
        rawY: y,
        rawWidth: boxWidth,
        rawHeight: boxHeight,
        imageWidth: width,
        imageHeight: height,
      },
    ];
  });
}

/**
 * Chooses the sampled frame nearest to the current playback time. Returns null
 * when the nearest persisted frame is too far away instead of showing stale
 * boxes on unrelated footage.
 */
export function findClosestVideoFrame(
  frames: VideoFrameDetection[] | null | undefined,
  currentTime: number,
  toleranceSeconds = 1.2
): VideoFrameDetection | null {
  if (!frames || frames.length === 0 || !Number.isFinite(currentTime)) return null;

  let closest: VideoFrameDetection | null = null;
  let smallestDifference = Infinity;

  for (const frame of frames) {
    const timestamp = finite(frame.timestamp);
    if (timestamp === null) continue;
    const difference = Math.abs(timestamp - currentTime);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closest = frame;
    }
  }

  return closest && smallestDifference <= toleranceSeconds ? closest : null;
}

function isDetectionResult(value: unknown): value is DetectionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<DetectionResult>;
  return Array.isArray(candidate.boxes);
}

/**
 * Builds the preview model for a MySQL inspection. Video inspections use the
 * exact detection metadata saved at inference time (including per-frame boxes).
 * Image inspections fall back to the persisted detection rows.
 */
export function buildInspectionDetection(
  inspection: StoredInspectionLike | null | undefined,
  detections: StoredDetectionLike[] | null | undefined
): DetectionResult | null {
  if (!inspection) return null;

  // MySQL drivers can return JSON columns as either parsed objects or strings
  // depending on configuration/version. Support both without inventing data.
  let metadata = inspection.detection_metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = null;
    }
  }
  if (isDetectionResult(metadata)) {
    return metadata;
  }

  const boxes = boxesFromStoredDetections(
    detections,
    inspection.image_width,
    inspection.image_height
  );
  if (boxes.length === 0) return null;

  const uniqueCount = finite(inspection.unique_pothole_count) ?? boxes.length;

  return {
    potholeCount: uniqueCount,
    uniquePotholeCount: uniqueCount,
    rawDetectionCount: finite(inspection.detection_count) ?? boxes.length,
    severity: severityFromRisk(inspection.overall_risk),
    confidence: boxes.reduce((sum, box) => sum + box.confidence, 0) / boxes.length,
    boxes,
    image: {
      width: finite(inspection.image_width) || 640,
      height: finite(inspection.image_height) || 640,
    },
    processedAt: inspection.created_at || new Date().toISOString(),
  };
}

export function isVideoDetection(detection?: DetectionResult | null): boolean {
  return Boolean(detection?.videoFrames?.length || detection?.video || detection?.videoUrl);
}
