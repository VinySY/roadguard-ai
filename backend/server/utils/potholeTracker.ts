/**
 * Multi-frame pothole tracker.
 *
 * The original video implementation only compared each frame with the frame
 * immediately before it and required IoU >= 0.70.  That is brittle for real
 * dashcam footage: camera motion, scale changes, a single missed detection, or
 * duplicate predictions within one frame all created new "unique" potholes.
 *
 * This tracker uses:
 *   - one-to-one greedy assignment (a detection cannot update two tracks)
 *   - motion prediction (constant velocity in image space)
 *   - mask IoU when available, bounding-box IoU otherwise
 *   - a centre-distance gate relative to object size for camera movement
 *   - track persistence through a configurable number of missed samples
 *   - confirmation by minimum hit count, with tentative tracks reported
 *     separately instead of silently inflating the unique count.
 */

import type {
  BoundingBox,
  RawPrediction,
  SanitizedPrediction,
} from './detectionPostprocess.js';
import {
  calculateBoxIoU,
  clamp,
  compareMasks,
  boxToCorners,
} from './detectionPostprocess.js';

export interface TrackFrame {
  frameIndex: number;
  timestamp: number;
  predictions: SanitizedPrediction[];
  image?: { width: number; height: number };
}

export interface TrackingOptions {
  /** Strong-overlap threshold. Proximity can still match below this value. */
  matchIouThreshold: number;
  /** Maximum centre distance as a multiple of mean object diagonal. */
  maxCenterDistanceFactor: number;
  /** Number of sampled frames a track may go undetected before it is lost. */
  maxMissedFrames: number;
  /** Minimum matched frames for a track to be counted as confirmed. */
  minHits: number;
  minScaleRatio: number;
  maxScaleRatio: number;
  /** Mask IoU used as an additional strong-match signal during tracking. */
  maskIouThreshold: number;
}

export interface TrackObservation {
  frameIndex: number;
  timestamp: number;
  prediction: SanitizedPrediction;
}

export interface PotholeTrack {
  trackId: string;
  hits: number;
  missed: number;
  firstFrameIndex: number;
  lastFrameIndex: number;
  firstTimestamp: number;
  lastTimestamp: number;
  firstPrediction: SanitizedPrediction;
  lastPrediction: SanitizedPrediction;
  bestObservation: TrackObservation;
  observations: TrackObservation[];
  velocity: { x: number; y: number };
  averageConfidence: number;
  maxConfidence: number;
  confirmed: boolean;
}

export interface TrackingResult {
  tracks: PotholeTrack[];
  confirmedTracks: PotholeTrack[];
  tentativeTracks: PotholeTrack[];
  uniquePotholeCount: number;
  confirmedPotholeCount: number;
  tentativePotholeCount: number;
  totalTracks: number;
  singleFrameTrackCount: number;
  representativeDetections: Array<SanitizedPrediction & {
    trackId: string;
    trackHits: number;
    frameIndex: number;
    timestamp: number;
  }>;
  parameters: TrackingOptions & { resolvedMinHits: number };
  quality: {
    level: 'high' | 'medium' | 'low';
    reasons: string[];
  };
  limitations: string[];
}

interface InternalTrack extends PotholeTrack {
  predictedCenter: { x: number; y: number };
}

export const DEFAULT_TRACKING_OPTIONS: Omit<TrackingOptions, 'minHits'> & { minHits: number | null } = {
  matchIouThreshold: 0.2,
  maxCenterDistanceFactor: 1.75,
  maxMissedFrames: 3,
  minHits: null,
  minScaleRatio: 0.3,
  maxScaleRatio: 3.0,
  maskIouThreshold: 0.1,
};

function centerOf(box: BoundingBox): { x: number; y: number } {
  return { x: box.x, y: box.y };
}

function diagonalOf(box: BoundingBox): number {
  return Math.hypot(box.width, box.height);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function boxAtCenter(center: { x: number; y: number }, size: { width: number; height: number }): BoundingBox {
  return {
    x: center.x,
    y: center.y,
    width: size.width,
    height: size.height,
  };
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  const ca = boxToCorners(a);
  const cb = boxToCorners(b);
  return ca.left < cb.right && ca.right > cb.left && ca.top < cb.bottom && ca.bottom > cb.top;
}

function updateTrack(
  track: InternalTrack,
  prediction: SanitizedPrediction,
  frame: TrackFrame,
): void {
  const previousCenter = centerOf(track.lastPrediction);
  const newCenter = centerOf(prediction);
  const gap = Math.max(1, frame.frameIndex - track.lastFrameIndex);

  // Smooth velocity; a slightly higher weight on recent motion handles pans.
  const alpha = gap === 1 ? 0.45 : 0.3;
  track.velocity = {
    x: track.velocity.x * (1 - alpha) + ((newCenter.x - previousCenter.x) / gap) * alpha,
    y: track.velocity.y * (1 - alpha) + ((newCenter.y - previousCenter.y) / gap) * alpha,
  };

  track.hits += 1;
  track.missed = 0;
  track.lastFrameIndex = frame.frameIndex;
  track.lastTimestamp = frame.timestamp;
  track.lastPrediction = prediction;
  track.observations.push({
    frameIndex: frame.frameIndex,
    timestamp: frame.timestamp,
    prediction,
  });

  if (prediction.confidence > track.bestObservation.prediction.confidence) {
    track.bestObservation = {
      frameIndex: frame.frameIndex,
      timestamp: frame.timestamp,
      prediction,
    };
  }

  const totalConfidence = track.observations.reduce((sum, observation) => sum + observation.prediction.confidence, 0);
  track.averageConfidence = totalConfidence / track.observations.length;
  track.maxConfidence = Math.max(track.maxConfidence, prediction.confidence);

  const predicted = {
    x: prediction.x + track.velocity.x,
    y: prediction.y + track.velocity.y,
  };
  track.predictedCenter = predicted;
}

function createTrack(
  trackId: string,
  prediction: SanitizedPrediction,
  frame: TrackFrame,
): InternalTrack {
  const observation: TrackObservation = {
    frameIndex: frame.frameIndex,
    timestamp: frame.timestamp,
    prediction,
  };

  return {
    trackId,
    hits: 1,
    missed: 0,
    firstFrameIndex: frame.frameIndex,
    lastFrameIndex: frame.frameIndex,
    firstTimestamp: frame.timestamp,
    lastTimestamp: frame.timestamp,
    firstPrediction: prediction,
    lastPrediction: prediction,
    bestObservation: observation,
    observations: [observation],
    velocity: { x: 0, y: 0 },
    averageConfidence: prediction.confidence,
    maxConfidence: prediction.confidence,
    confirmed: false,
    predictedCenter: centerOf(prediction),
  };
}

interface CandidateMatch {
  track: InternalTrack;
  detectionIndex: number;
  score: number;
}

/**
 * Associates detections in one frame with existing tracks.
 *
 * One-to-one greedy assignment is used because the number of potholes per
 * frame is small and it avoids the common failure mode where a single track
 * absorbs two distinct nearby potholes.
 */
function matchFrame(
  tracks: InternalTrack[],
  frame: TrackFrame,
  options: TrackingOptions,
): Array<{ track: InternalTrack; detectionIndex: number; score: number }> {
  const candidates: CandidateMatch[] = [];

  for (const track of tracks) {
    if (frame.frameIndex <= track.lastFrameIndex) continue;

    const gap = frame.frameIndex - track.lastFrameIndex;
    if (gap > options.maxMissedFrames + 1) continue;

    const predictedCenter = {
      x: track.lastPrediction.x + track.velocity.x * gap,
      y: track.lastPrediction.y + track.velocity.y * gap,
    };
    const predictedBox = boxAtCenter(predictedCenter, track.lastPrediction);

    for (let detectionIndex = 0; detectionIndex < frame.predictions.length; detectionIndex += 1) {
      const detection = frame.predictions[detectionIndex];
      const detectionBox: BoundingBox = {
        x: detection.x,
        y: detection.y,
        width: detection.width,
        height: detection.height,
      };

      const trackDiagonal = diagonalOf(track.lastPrediction);
      const detectionDiagonal = diagonalOf(detection);
      const meanDiagonal = Math.max(1, (trackDiagonal + detectionDiagonal) / 2);
      const sizeRatio = detectionDiagonal / Math.max(1, trackDiagonal);

      if (sizeRatio < options.minScaleRatio || sizeRatio > options.maxScaleRatio) continue;

      const centreDistance = distance(predictedCenter, centerOf(detectionBox));
      const maxDistance = Math.max(12, options.maxCenterDistanceFactor * meanDiagonal);

      const boxOverlap = calculateBoxIoU(predictedBox, detectionBox);
      const lastBoxOverlap = calculateBoxIoU(track.lastPrediction, detectionBox);
      let maskOverlap = 0;
      if (track.lastPrediction.points && detection.points) {
        const mask = compareMasks(track.lastPrediction.points, detection.points, 40);
        if (mask) maskOverlap = mask.maskIoU;
      }

      const overlap = Math.max(boxOverlap, lastBoxOverlap, maskOverlap);
      const strongMatch = overlap >= options.matchIouThreshold || maskOverlap >= options.maskIouThreshold;
      const proximityMatch = centreDistance <= maxDistance;
      const boxesTouch = boxesOverlap(predictedBox, detectionBox) || boxesOverlap(track.lastPrediction, detectionBox);

      // Require either meaningful overlap or proximity. This explicitly allows
      // camera motion while preventing distant unrelated objects from matching.
      if (!strongMatch && !proximityMatch) continue;
      if (!strongMatch && !boxesTouch && centreDistance > maxDistance * 0.75) continue;

      const overlapScore = clamp(
        overlap / Math.max(options.matchIouThreshold, options.maskIouThreshold, 0.01),
        0,
        1,
      );
      const proximityScore = clamp(1 - centreDistance / maxDistance, 0, 1);
      const sizeScore = clamp(1 - Math.abs(Math.log(sizeRatio)) / Math.log(options.maxScaleRatio), 0, 1);
      const score = 0.45 * overlapScore + 0.35 * proximityScore + 0.15 * sizeScore + 0.05 * detection.confidence;

      candidates.push({ track, detectionIndex, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const assignedTracks = new Set<string>();
  const assignedDetections = new Set<number>();
  const matches: Array<{ track: InternalTrack; detectionIndex: number; score: number }> = [];

  for (const candidate of candidates) {
    if (assignedTracks.has(candidate.track.trackId)) continue;
    if (assignedDetections.has(candidate.detectionIndex)) continue;
    if (candidate.score < 0.05) continue;

    assignedTracks.add(candidate.track.trackId);
    assignedDetections.add(candidate.detectionIndex);
    matches.push(candidate);
  }

  return matches;
}

function buildQuality(
  frames: TrackFrame[],
  tracks: PotholeTrack[],
  errors: number,
  options: TrackingOptions,
  resolvedMinHits: number,
): { quality: TrackingResult['quality']; limitations: string[] } {
  const framesWithDetections = frames.filter((frame) => frame.predictions.length > 0).length;
  const tentativeCount = tracks.filter((track) => track.hits < resolvedMinHits).length;
  const singleFrameCount = tracks.filter((track) => track.hits === 1).length;
  const reasons: string[] = [];
  const limitations: string[] = [];

  if (frames.length < 3) {
    reasons.push(`Only ${frames.length} sampled frame(s); temporal association is weak.`);
    limitations.push('Very few frames were sampled. Treat the unique count as indicative, not exact.');
  } else if (frames.length < 5) {
    reasons.push(`Only ${frames.length} sampled frame(s); track confirmation has limited support.`);
    limitations.push(
      `Only ${frames.length} sampled frames were available; treat the unique count as indicative rather than exact.`,
    );
  }
  if (framesWithDetections < 2) {
    reasons.push('Detections were present in fewer than two sampled frames.');
    limitations.push('Detections are sparse across the sample. Cross-frame unique counting is unreliable.');
  }
  if (errors > 0) {
    reasons.push(`${errors} frame(s) failed detection.`);
    limitations.push('One or more frames failed detection; some pothole tracks may be incomplete.');
  }
  if (tentativeCount > 0) {
    reasons.push(`${tentativeCount} track(s) did not reach the ${resolvedMinHits}-frame confirmation threshold.`);
    limitations.push('Some potholes were visible in too few sampled frames to confirm; they are reported as tentative tracks.');
  }
  if (singleFrameCount > 0 && tentativeCount > 0) {
    limitations.push('Single-frame detections are reported separately because they can be false positives or briefly visible potholes.');
  }

  let level: 'high' | 'medium' | 'low' = 'high';
  if (frames.length < 3 || framesWithDetections < 2) level = 'low';
  else if (frames.length < 5 || errors > 0 || tentativeCount > 0) level = 'medium';

  if (tracks.length === 0) {
    reasons.push('No pothole detections survived confidence filtering and duplicate suppression.');
  }

  return { quality: { level, reasons }, limitations };
}

export interface TrackPotholesOptions extends Partial<TrackingOptions> {
  /** Number of extracted frames that failed inference (used for reliability). */
  failedFrameCount?: number;
}

/**
 * Tracks potholes across sampled frames and returns a unique count.
 *
 * `uniquePotholeCount` counts confirmed tracks only. Tracks below `minHits`
 * are exposed as `tentativePotholeCount` and are never silently added to the
 * final count.
 */
export function trackPotholes(frames: TrackFrame[], options: TrackPotholesOptions = {}): TrackingResult {
  const resolvedMinHits = options.minHits
    ?? (frames.length >= 4 ? 2 : 1);

  const resolved: TrackingOptions = {
    matchIouThreshold: options.matchIouThreshold ?? DEFAULT_TRACKING_OPTIONS.matchIouThreshold,
    maxCenterDistanceFactor: options.maxCenterDistanceFactor ?? DEFAULT_TRACKING_OPTIONS.maxCenterDistanceFactor,
    maxMissedFrames: options.maxMissedFrames ?? DEFAULT_TRACKING_OPTIONS.maxMissedFrames,
    minHits: resolvedMinHits,
    minScaleRatio: options.minScaleRatio ?? DEFAULT_TRACKING_OPTIONS.minScaleRatio,
    maxScaleRatio: options.maxScaleRatio ?? DEFAULT_TRACKING_OPTIONS.maxScaleRatio,
    maskIouThreshold: options.maskIouThreshold ?? DEFAULT_TRACKING_OPTIONS.maskIouThreshold,
  };

  const tracks: InternalTrack[] = [];
  let nextTrackNumber = 1;

  for (const frame of frames) {
    const activeTracks = tracks.filter(
      (track) => frame.frameIndex - track.lastFrameIndex <= resolved.maxMissedFrames + 1,
    );

    const matches = matchFrame(activeTracks, frame, resolved);
    const matchedTracks = new Set(matches.map((match) => match.track.trackId));
    const matchedDetections = new Set(matches.map((match) => match.detectionIndex));

    for (const match of matches) {
      const prediction = frame.predictions[match.detectionIndex];
      updateTrack(match.track, prediction, frame);
      (prediction as any).trackId = match.track.trackId;
      (prediction as any).trackScore = parseFloat(match.score.toFixed(4));
    }

    for (let detectionIndex = 0; detectionIndex < frame.predictions.length; detectionIndex += 1) {
      if (matchedDetections.has(detectionIndex)) continue;

      const prediction = frame.predictions[detectionIndex];
      const trackId = `pothole_track_${nextTrackNumber}`;
      nextTrackNumber += 1;
      const track = createTrack(trackId, prediction, frame);
      tracks.push(track);
      (prediction as any).trackId = trackId;
      (prediction as any).trackScore = 1;
    }

    // Age unmatched tracks in terms of sampled-frame gaps.
    for (const track of tracks) {
      if (matchedTracks.has(track.trackId)) continue;
      if (frame.frameIndex > track.lastFrameIndex) {
        track.missed = frame.frameIndex - track.lastFrameIndex;
        track.velocity = {
          x: track.velocity.x * 0.9,
          y: track.velocity.y * 0.9,
        };
      }
    }
  }

  for (const track of tracks) {
    track.confirmed = track.hits >= resolved.minHits;
    for (const observation of track.observations) {
      (observation.prediction as any).trackId = track.trackId;
      (observation.prediction as any).trackHits = track.hits;
      (observation.prediction as any).trackConfirmed = track.confirmed;
    }
  }

  const confirmedTracks = tracks.filter((track) => track.confirmed);
  const tentativeTracks = tracks.filter((track) => !track.confirmed);
  const singleFrameTrackCount = tracks.filter((track) => track.hits === 1).length;

  const representativeDetections = confirmedTracks.map((track) => {
    const best = track.bestObservation;
    return {
      ...best.prediction,
      trackId: track.trackId,
      trackHits: track.hits,
      frameIndex: best.frameIndex,
      timestamp: best.timestamp,
    };
  });

  const { quality, limitations } = buildQuality(
    frames,
    tracks,
    options.failedFrameCount ?? 0,
    resolved,
    resolved.minHits,
  );

  return {
    tracks,
    confirmedTracks,
    tentativeTracks,
    uniquePotholeCount: confirmedTracks.length,
    confirmedPotholeCount: confirmedTracks.length,
    tentativePotholeCount: tentativeTracks.length,
    totalTracks: tracks.length,
    singleFrameTrackCount,
    representativeDetections,
    parameters: {
      ...resolved,
      resolvedMinHits: resolved.minHits,
    },
    quality,
    limitations,
  };
}

/** Compact track summaries safe to return in API responses. */
export function summarizeTracks(tracks: PotholeTrack[]) {
  return tracks.map((track) => ({
    trackId: track.trackId,
    hits: track.hits,
    missed: track.missed,
    confirmed: track.confirmed,
    firstFrameIndex: track.firstFrameIndex,
    lastFrameIndex: track.lastFrameIndex,
    firstTimestamp: track.firstTimestamp,
    lastTimestamp: track.lastTimestamp,
    averageConfidence: parseFloat(track.averageConfidence.toFixed(4)),
    maxConfidence: parseFloat(track.maxConfidence.toFixed(4)),
    bbox: {
      x: parseFloat(track.lastPrediction.x.toFixed(2)),
      y: parseFloat(track.lastPrediction.y.toFixed(2)),
      width: parseFloat(track.lastPrediction.width.toFixed(2)),
      height: parseFloat(track.lastPrediction.height.toFixed(2)),
    },
  }));
}

export type { RawPrediction };
