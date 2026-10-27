/**
 * Detection post-processing for RoadGuard AI.
 *
 * Roboflow's instance-segmentation model can return several predictions for
 * one physical pothole.  In particular this model has several synonym classes
 * ("Pothole", "Potholes", "pothole", "potholes", "object") and the hosted
 * endpoint can emit overlapping boxes/masks for the same object.  Counting
 * `predictions.length` therefore over-reports potholes.
 *
 * This module centralises:
 *   - validation / sanitising of Roboflow responses
 *   - confidence filtering
 *   - mask-aware, class-agnostic duplicate suppression (within a frame/image)
 *   - severity / analytics enrichment
 *
 * It deliberately does NOT merge detections merely because their centres are
 * close.  When segmentation masks are available they are the primary signal;
 * bounding-box IoU is only used when masks are missing, or as a fallback for
 * malformed masks.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RawPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class?: string;
  class_id?: number;
  points?: Point[];
  detection_id?: string;
  [key: string]: unknown;
}

export interface SanitizedPrediction extends RawPrediction {
  points?: Point[];
  maskArea?: number;
  maskAreaRatio?: number;
  duplicateCount?: number;
  mergedDetectionIds?: string[];
}

export interface ImageMetadata {
  width: number;
  height: number;
}

export interface ValidatedRoboflowResponse {
  image: ImageMetadata;
  predictions: SanitizedPrediction[];
  rawPredictionCount: number;
  invalidPredictionCount: number;
  warnings: string[];
}

export interface DeduplicationOptions {
  /** IoU of segmentation masks at which two masks are the same pothole. */
  maskIouThreshold: number;
  /** Intersection-over-smaller-mask threshold used for nested duplicate masks. */
  containmentThreshold: number;
  /** Ignore containment matches when one mask is much smaller than the other. */
  minAreaRatioForContainment: number;
  /** Fallback bbox IoU threshold when masks are not available. */
  boxIouThreshold: number;
  /** Raster resolution used to compare masks (cells along the longest side). */
  rasterSize?: number;
}

export interface DeduplicationResult<T extends RawPrediction> {
  predictions: T[];
  candidateCount: number;
  duplicateCount: number;
  suppressed: Array<{
    kept: T;
    removed: T;
    maskIoU: number | null;
    maskIoS: number | null;
    boxIoU: number;
  }>;
}

export interface EnrichedPrediction extends SanitizedPrediction {
  id: string;
  area: number;
  areaRatio: number;
  severity: 'minor' | 'moderate' | 'high' | 'critical';
}

export const DEFAULT_CONFIDENCE_PERCENT = 20;
export const DEFAULT_OVERLAP_PERCENT = 30;
export const DEFAULT_MASK_IOU_THRESHOLD = 0.65;
export const DEFAULT_CONTAINMENT_THRESHOLD = 0.9;
export const DEFAULT_MIN_AREA_RATIO_FOR_CONTAINMENT = 0.35;
export const DEFAULT_BOX_IOU_THRESHOLD = 0.8;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Parses a confidence/overlap query value expressed as a percentage (0-100).
 * Returns null for malformed values so the route can return HTTP 400 instead
 * of silently forwarding NaN to Roboflow.
 */
export function parsePercentParam(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return null;
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 100) return null;
  return parsed;
}

/** Parses a 0-1 unit interval query parameter. */
export function parseUnitIntervalParam(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return null;
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 1) return null;
  return parsed;
}

/** Parses a bounded integer query parameter. */
export function parseIntegerParam(value: unknown, fallback: number | null, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return null;
  const parsed = toFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/** Parses common boolean query spellings. */
export function parseBooleanParam(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(Array.isArray(value) ? value[0] : value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

export function boxFromPrediction(prediction: BoundingBox): BoundingBox {
  return {
    x: prediction.x,
    y: prediction.y,
    width: prediction.width,
    height: prediction.height,
  };
}

export function boxToCorners(box: BoundingBox): { left: number; top: number; right: number; bottom: number } {
  return {
    left: box.x - box.width / 2,
    top: box.y - box.height / 2,
    right: box.x + box.width / 2,
    bottom: box.y + box.height / 2,
  };
}

/** Box IoU. Coordinates are Roboflow's centre-based pixel coordinates. */
export function calculateBoxIoU(box1: BoundingBox, box2: BoundingBox): number {
  const a = boxToCorners(box1);
  const b = boxToCorners(box2);

  const interLeft = Math.max(a.left, b.left);
  const interRight = Math.min(a.right, b.right);
  const interTop = Math.max(a.top, b.top);
  const interBottom = Math.min(a.bottom, b.bottom);

  if (interLeft >= interRight || interTop >= interBottom) return 0;

  const interArea = (interRight - interLeft) * (interBottom - interTop);
  const unionArea = box1.width * box1.height + box2.width * box2.height - interArea;
  return unionArea <= 0 ? 0 : interArea / unionArea;
}

export function polygonSignedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function polygonArea(points: Point[]): number {
  return Math.abs(polygonSignedArea(points));
}

export function polygonBounds(points: Point[]): { left: number; top: number; right: number; bottom: number } {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of points) {
    if (point.x < left) left = point.x;
    if (point.y < top) top = point.y;
    if (point.x > right) right = point.x;
    if (point.y > bottom) bottom = point.y;
  }
  return { left, top, right, bottom };
}

/** Even-odd ray-casting test. Works for self-intersecting polygons. */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export interface MaskOverlap {
  maskIoU: number;
  maskIoS: number;
  intersectionArea: number;
  areaA: number;
  areaB: number;
  rasterSize: number;
}

/**
 * Rasterised mask comparison.
 *
 * Roboflow mask polygons are usually simple, but some predictions contain
 * self-intersecting or densely sampled contours where a Sutherland-Hodgman
 * clipper produces empty intersections.  A small raster grid is slower than
 * analytic clipping but is robust to those contours and to holes.
 */
export function compareMasks(
  pointsA: Point[] | undefined,
  pointsB: Point[] | undefined,
  rasterSize = 48
): MaskOverlap | null {
  if (!pointsA || !pointsB || pointsA.length < 3 || pointsB.length < 3) return null;

  const boundsA = polygonBounds(pointsA);
  const boundsB = polygonBounds(pointsB);
  const left = Math.max(boundsA.left, boundsB.left);
  const top = Math.max(boundsA.top, boundsB.top);
  const right = Math.min(boundsA.right, boundsB.right);
  const bottom = Math.min(boundsA.bottom, boundsB.bottom);

  // Disjoint mask bounds can never be the same physical pothole.
  if (left >= right || top >= bottom) {
    const areaA = polygonArea(pointsA);
    const areaB = polygonArea(pointsB);
    return {
      maskIoU: 0,
      maskIoS: 0,
      intersectionArea: 0,
      areaA,
      areaB,
      rasterSize,
    };
  }

  const unionLeft = Math.min(boundsA.left, boundsB.left);
  const unionTop = Math.min(boundsA.top, boundsB.top);
  const unionRight = Math.max(boundsA.right, boundsB.right);
  const unionBottom = Math.max(boundsA.bottom, boundsB.bottom);

  const width = Math.max(1, unionRight - unionLeft);
  const height = Math.max(1, unionBottom - unionTop);
  const cells = Math.max(8, Math.min(96, Math.floor(rasterSize)));
  const cellSize = Math.max(width, height) / cells;

  let countA = 0;
  let countB = 0;
  let countBoth = 0;

  // Sample cell centres. A half-cell inset keeps samples inside the bounds.
  for (let y = unionTop + cellSize / 2; y < unionBottom; y += cellSize) {
    for (let x = unionLeft + cellSize / 2; x < unionRight; x += cellSize) {
      const point = { x, y };
      const inA = pointInPolygon(point, pointsA);
      const inB = pointInPolygon(point, pointsB);
      if (inA) countA += 1;
      if (inB) countB += 1;
      if (inA && inB) countBoth += 1;
    }
  }

  const areaUnit = cellSize * cellSize;
  const areaA = countA * areaUnit;
  const areaB = countB * areaUnit;
  const intersectionArea = countBoth * areaUnit;
  const unionArea = areaA + areaB - intersectionArea;

  return {
    maskIoU: unionArea > 0 ? intersectionArea / unionArea : 0,
    maskIoS: Math.min(areaA, areaB) > 0 ? intersectionArea / Math.min(areaA, areaB) : 0,
    intersectionArea,
    areaA,
    areaB,
    rasterSize: cells,
  };
}

function sanitizePoints(value: unknown): Point[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const points: Point[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const x = toFiniteNumber((raw as any).x);
    const y = toFiniteNumber((raw as any).y);
    if (x === null || y === null) continue;
    points.push({ x, y });
  }
  return points.length >= 3 ? points : undefined;
}

/**
 * Validates and normalises one Roboflow prediction. Returns null when the
 * prediction cannot be represented safely (missing/invalid geometry or
 * confidence). Coordinates are intentionally not clamped so annotations keep
 * the model's original geometry; only truly invalid entries are dropped.
 */
export function sanitizePrediction(raw: unknown, image: ImageMetadata): SanitizedPrediction | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  const x = toFiniteNumber(candidate.x);
  const y = toFiniteNumber(candidate.y);
  const width = toFiniteNumber(candidate.width);
  const height = toFiniteNumber(candidate.height);
  const confidence = toFiniteNumber(candidate.confidence);

  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;
  if (confidence === null || confidence < 0 || confidence > 1) return null;

  const className = typeof candidate.class === 'string' && candidate.class.trim()
    ? candidate.class.trim()
    : 'pothole';

  const points = sanitizePoints(candidate.points);
  const prediction: SanitizedPrediction = {
    ...candidate,
    x,
    y,
    width,
    height,
    confidence,
    class: className,
    points,
  };

  if (points) {
    const area = polygonArea(points);
    if (area > 0) {
      prediction.maskArea = area;
      prediction.maskAreaRatio = image.width * image.height > 0
        ? parseFloat(((area / (image.width * image.height)) * 100).toFixed(3))
        : undefined;
    } else {
      // Keep the bbox but drop unusable mask geometry.
      delete prediction.points;
    }
  }

  return prediction;
}

export class InvalidRoboflowResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoboflowResponseError';
  }
}

/**
 * Validates the top-level Roboflow response. A missing `predictions` array is
 * treated as a valid empty result (Roboflow sometimes omits it when nothing is
 * detected), while a non-object response is a hard error.
 */
export function validateRoboflowResponse(result: unknown, fallbackImage: ImageMetadata = { width: 640, height: 640 }): ValidatedRoboflowResponse {
  const warnings: string[] = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new InvalidRoboflowResponseError('Roboflow response is not a JSON object');
  }

  const payload = result as Record<string, unknown>;
  const rawImage = payload.image && typeof payload.image === 'object'
    ? payload.image as Record<string, unknown>
    : null;

  const parsedWidth = rawImage ? toFiniteNumber(rawImage.width) : null;
  const parsedHeight = rawImage ? toFiniteNumber(rawImage.height) : null;
  const width = parsedWidth && parsedWidth > 0 ? parsedWidth : fallbackImage.width;
  const height = parsedHeight && parsedHeight > 0 ? parsedHeight : fallbackImage.height;

  if (!parsedWidth || !parsedHeight) {
    warnings.push('Roboflow response did not include valid image dimensions; using fallback dimensions for analytics.');
  }

  let rawPredictions: unknown[] = [];
  if (Array.isArray(payload.predictions)) {
    rawPredictions = payload.predictions;
  } else if (payload.predictions !== undefined && payload.predictions !== null) {
    warnings.push('Roboflow response contained a malformed predictions field; treating it as empty.');
  }

  const predictions: SanitizedPrediction[] = [];
  for (const raw of rawPredictions) {
    const sanitized = sanitizePrediction(raw, { width, height });
    if (sanitized) predictions.push(sanitized);
  }

  const invalidPredictionCount = rawPredictions.length - predictions.length;
  if (invalidPredictionCount > 0) {
    warnings.push(`${invalidPredictionCount} malformed prediction(s) were ignored.`);
  }

  return {
    image: { width, height },
    predictions,
    rawPredictionCount: rawPredictions.length,
    invalidPredictionCount,
    warnings,
  };
}

export function filterByConfidence<T extends RawPrediction>(predictions: T[], minConfidence: number): T[] {
  return predictions.filter((prediction) => prediction.confidence >= minConfidence);
}

function isSamePhysicalPothole(
  a: SanitizedPrediction,
  b: SanitizedPrediction,
  options: DeduplicationOptions
): { same: boolean; maskIoU: number | null; maskIoS: number | null; boxIoU: number } {
  const boxIoU = calculateBoxIoU(boxFromPrediction(a), boxFromPrediction(b));

  if (a.points && b.points) {
    const overlap = compareMasks(a.points, b.points, options.rasterSize ?? 48);
    if (overlap && overlap.areaA > 0 && overlap.areaB > 0) {
      const areaRatio = Math.min(overlap.areaA, overlap.areaB) / Math.max(overlap.areaA, overlap.areaB);
      // Containment only suppresses a *smaller* mask nested inside the kept
      // one. A lower-confidence mask that is larger than the kept mask may
      // span two touching potholes; merging it would hide a real pothole.
      const candidateIsNested = overlap.areaB <= overlap.areaA * 1.02;
      const same = overlap.maskIoU >= options.maskIouThreshold
        || (
          candidateIsNested
          && overlap.maskIoS >= options.containmentThreshold
          && areaRatio >= options.minAreaRatioForContainment
        );
      return { same, maskIoU: overlap.maskIoU, maskIoS: overlap.maskIoS, boxIoU };
    }
  }

  return {
    same: boxIoU >= options.boxIouThreshold,
    maskIoU: null,
    maskIoS: null,
    boxIoU,
  };
}

/**
 * Greedy class-agnostic duplicate suppression within one image/frame.
 *
 * Kept predictions are the highest-confidence representatives. Suppressed
 * duplicates are recorded on the kept prediction (`duplicateCount`,
 * `mergedDetectionIds`) so annotated output and debugging retain provenance.
 */
export function deduplicatePredictions<T extends SanitizedPrediction>(
  predictions: T[],
  options: Partial<DeduplicationOptions> = {}
): DeduplicationResult<T> {
  const resolved: DeduplicationOptions = {
    maskIouThreshold: options.maskIouThreshold ?? DEFAULT_MASK_IOU_THRESHOLD,
    containmentThreshold: options.containmentThreshold ?? DEFAULT_CONTAINMENT_THRESHOLD,
    minAreaRatioForContainment: options.minAreaRatioForContainment ?? DEFAULT_MIN_AREA_RATIO_FOR_CONTAINMENT,
    boxIouThreshold: options.boxIouThreshold ?? DEFAULT_BOX_IOU_THRESHOLD,
    rasterSize: options.rasterSize ?? 48,
  };

  // Stable confidence-descending order. Highest-confidence prediction wins.
  const ordered = predictions
    .map((prediction, index) => ({ prediction, index }))
    .sort((a, b) => (b.prediction.confidence - a.prediction.confidence) || (a.index - b.index))
    .map(({ prediction }) => prediction);

  const kept: T[] = [];
  const suppressed: DeduplicationResult<T>['suppressed'] = [];

  for (const candidate of ordered) {
    let duplicateOf: T | null = null;
    let match: { maskIoU: number | null; maskIoS: number | null; boxIoU: number } | null = null;

    for (const existing of kept) {
      const comparison = isSamePhysicalPothole(existing, candidate, resolved);
      if (comparison.same) {
        duplicateOf = existing;
        match = comparison;
        break;
      }
    }

    if (duplicateOf) {
      duplicateOf.duplicateCount = (duplicateOf.duplicateCount ?? 0) + 1;
      if (candidate.detection_id) {
        duplicateOf.mergedDetectionIds = [
          ...(duplicateOf.mergedDetectionIds ?? []),
          candidate.detection_id,
        ];
      }
      suppressed.push({
        kept: duplicateOf,
        removed: candidate,
        maskIoU: match?.maskIoU ?? null,
        maskIoS: match?.maskIoS ?? null,
        boxIoU: match?.boxIoU ?? 0,
      });
    } else {
      kept.push(candidate);
    }
  }

  return {
    predictions: kept,
    candidateCount: predictions.length,
    duplicateCount: suppressed.length,
    suppressed,
  };
}

export function calculateRiskLevel(uniqueCount: number, damagePercentage: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (uniqueCount >= 4 || damagePercentage > 15) return 'CRITICAL';
  if (uniqueCount >= 2 || damagePercentage > 7) return 'HIGH';
  if (uniqueCount === 1 || damagePercentage > 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Adds ids, bbox area, area ratio and severity while preserving every original
 * Roboflow field (class, confidence, x/y/width/height, points, detection_id).
 */
export function enrichPredictions(
  predictions: SanitizedPrediction[],
  image: ImageMetadata
): EnrichedPrediction[] {
  const totalImageArea = Math.max(1, image.width * image.height);

  return predictions.map((prediction, index) => {
    const area = prediction.width * prediction.height;
    const areaRatio = (area / totalImageArea) * 100;
    let severity: EnrichedPrediction['severity'] = 'minor';
    if (areaRatio > 12 || prediction.confidence > 0.85) severity = 'critical';
    else if (areaRatio > 6 || prediction.confidence > 0.70) severity = 'high';
    else if (areaRatio > 2 || prediction.confidence > 0.50) severity = 'moderate';

    return {
      ...prediction,
      id: `pothole-${index + 1}`,
      area,
      areaRatio: parseFloat(areaRatio.toFixed(2)),
      severity,
    };
  });
}

export function sumBoxArea(predictions: RawPrediction[]): number {
  return predictions.reduce((total, prediction) => total + (prediction.width || 0) * (prediction.height || 0), 0);
}

export function calculateDamagePercentage(predictions: RawPrediction[], image: ImageMetadata): number {
  const totalImageArea = Math.max(1, image.width * image.height);
  return parseFloat(((sumBoxArea(predictions) / totalImageArea) * 100).toFixed(2));
}

export function maxConfidenceOf(predictions: RawPrediction[]): number {
  return predictions.reduce((max, prediction) => Math.max(max, prediction.confidence || 0), 0);
}
