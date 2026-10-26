/**
 * IoU / tracking compatibility layer.
 *
 * The canonical geometry helpers now live in `detectionPostprocess.ts` and the
 * tracker in `potholeTracker.ts`.  These exports remain for existing imports
 * and older tests/clients that used `deduplicateDetectionsAcrossFrames`.
 */

import {
  BoundingBox,
  RawPrediction,
  SanitizedPrediction,
  boxFromPrediction,
  calculateBoxIoU,
  compareMasks,
} from './detectionPostprocess.js';
import { trackPotholes, TrackFrame } from './potholeTracker.js';

export { BoundingBox };

export interface TrackedDetection {
  prediction: any;
  frameIndex: number;
  timestamp: number;
  uniqueId: string;
}

/** Backwards-compatible wrapper around the stronger multi-frame tracker. */
export function deduplicateDetectionsAcrossFrames(
  frameResults: any[],
  iouThreshold: number = 0.70,
): {
  trackedDetections: TrackedDetection[];
  uniquePotholeCount: number;
  potholeIdMap: Map<string, string>;
} {
  const frames: TrackFrame[] = frameResults.map((frame: any, index: number) => ({
    frameIndex: typeof frame.frameIndex === 'number' ? frame.frameIndex : index,
    timestamp: typeof frame.timestamp === 'number' ? frame.timestamp : index,
    predictions: (frame.predictions || []) as SanitizedPrediction[],
    image: frame.image,
  }));

  // The old API used a high default IoU (0.70). The tracker keeps that as the
  // strong-overlap signal but also allows motion-compensated proximity matches.
  const result = trackPotholes(frames, {
    matchIouThreshold: iouThreshold,
    minHits: 1,
  });

  const trackedDetections: TrackedDetection[] = result.tracks.flatMap((track) =>
    track.observations.map((observation) => ({
      prediction: observation.prediction,
      frameIndex: observation.frameIndex,
      timestamp: observation.timestamp,
      uniqueId: track.trackId,
    })),
  );

  return {
    trackedDetections,
    uniquePotholeCount: result.uniquePotholeCount,
    potholeIdMap: new Map(),
  };
}

export { calculateBoxIoU as calculateIoU, compareMasks };

// Kept for callers that only need a single box pair.
export function calculatePredictionIoU(a: RawPrediction, b: RawPrediction): number {
  return calculateBoxIoU(boxFromPrediction(a), boxFromPrediction(b));
}
