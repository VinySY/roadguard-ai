/**
 * Count helpers shared by every RoadGuard view.
 *
 * The backend reports two different numbers:
 *   - raw detections (model predictions / frame-level boxes)
 *   - unique potholes (after same-frame duplicate suppression and cross-frame
 *     tracking)
 *
 * The unique count is always the user-facing answer. These helpers make the
 * precedence explicit so no view accidentally displays the raw total.
 */

export interface DetectionCountAnalytics {
  uniquePotholeCount?: number | null;
  rawDetectionCount?: number | null;
  totalDetected?: number | null;
  totalDetections?: number | null;
  duplicatePredictionsRemoved?: number | null;
}

export interface DetectionCountSource {
  potholeCount?: number | null;
  uniquePotholeCount?: number | null;
  rawDetectionCount?: number | null;
  analytics?: DetectionCountAnalytics | null;
}

export interface InspectionCountSource {
  unique_pothole_count?: number | null;
  detection_count?: number | null;
}

export function toFiniteCount(value: unknown): number | null {
  // Treat null/undefined/blank as "not reported" rather than as zero, so
  // `unique_pothole_count: null` falls back to the legacy detection_count.
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

/** The final answer: unique physical potholes. */
export function resolveUniquePotholeCount(source: DetectionCountSource | null | undefined): number {
  if (!source) return 0;

  const candidates = [
    source.analytics?.uniquePotholeCount,
    source.uniquePotholeCount,
    source.potholeCount,
    // `totalDetected` is unique for images and for the new video payload.
    source.analytics?.totalDetected,
  ];

  for (const candidate of candidates) {
    const count = toFiniteCount(candidate);
    if (count !== null) return count;
  }

  return 0;
}

/** Raw detections before cross-frame tracking (video) / dedup (legacy image). */
export function resolveRawDetectionCount(source: DetectionCountSource | null | undefined): number {
  if (!source) return 0;

  const candidates = [
    source.analytics?.rawDetectionCount,
    source.rawDetectionCount,
    source.analytics?.totalDetections,
  ];

  for (const candidate of candidates) {
    const count = toFiniteCount(candidate);
    if (count !== null) return count;
  }

  // Legacy image payload: totalDetected was the raw prediction count.
  return resolveUniquePotholeCount(source);
}

/** Number of duplicate/overlapping predictions merged away, if reported. */
export function resolveDuplicateCount(source: DetectionCountSource | null | undefined): number {
  const explicit = toFiniteCount(source?.analytics?.duplicatePredictionsRemoved);
  if (explicit !== null) return explicit;

  const raw = resolveRawDetectionCount(source);
  const unique = resolveUniquePotholeCount(source);
  return Math.max(0, raw - unique);
}

/** History rows: prefer the deduplicated column when available. */
export function resolveInspectionUniqueCount(inspection: InspectionCountSource | null | undefined): number {
  if (!inspection) return 0;

  const unique = toFiniteCount(inspection.unique_pothole_count);
  if (unique !== null) return unique;

  return toFiniteCount(inspection.detection_count) ?? 0;
}

export function formatPotholeCount(count: number): string {
  return `${count} ${count === 1 ? 'pothole' : 'potholes'}`;
}

/**
 * Secondary debug label, e.g. "12 raw frame detections · 40 merged".
 * Returns null when raw and unique are the same (nothing to explain).
 */
export function describeRawVsUnique(source: DetectionCountSource | null | undefined): string | null {
  const unique = resolveUniquePotholeCount(source);
  const raw = resolveRawDetectionCount(source);
  const duplicates = resolveDuplicateCount(source);

  if (raw <= unique || duplicates <= 0) return null;

  return `${raw} raw detection${raw === 1 ? '' : 's'} · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} merged`;
}
