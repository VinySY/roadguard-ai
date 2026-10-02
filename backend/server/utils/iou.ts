/**
 * IoU (Intersection over Union) Utilities
 *
 * Used for deduplicating pothole detections across video frames.
 * Two detections are considered the same pothole if their IoU >= threshold.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes.
 *
 * IoU = Intersection Area / Union Area
 *
 * @param box1 First bounding box (x, y, width, height)
 * @param box2 Second bounding box (x, y, width, height)
 * @returns IoU value between 0 and 1
 */
export function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  // Convert center-based coordinates to corner-based
  const box1Left = box1.x - box1.width / 2;
  const box1Right = box1.x + box1.width / 2;
  const box1Top = box1.y - box1.height / 2;
  const box1Bottom = box1.y + box1.height / 2;

  const box2Left = box2.x - box2.width / 2;
  const box2Right = box2.x + box2.width / 2;
  const box2Top = box2.y - box2.height / 2;
  const box2Bottom = box2.y + box2.height / 2;

  // Calculate intersection
  const interLeft = Math.max(box1Left, box2Left);
  const interRight = Math.min(box1Right, box2Right);
  const interTop = Math.max(box1Top, box2Top);
  const interBottom = Math.min(box1Bottom, box2Bottom);

  // If boxes don't overlap, intersection area is 0
  if (interLeft >= interRight || interTop >= interBottom) {
    return 0;
  }

  const interArea = (interRight - interLeft) * (interBottom - interTop);

  // Calculate union
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - interArea;

  // Avoid division by zero
  if (unionArea === 0) {
    return 0;
  }

  return interArea / unionArea;
}

/**
 * Detection with tracking metadata.
 */
export interface TrackedDetection {
  prediction: any;  // Original Roboflow prediction
  frameIndex: number;
  timestamp: number;
  uniqueId: string;  // Assigned unique pothole ID
}

/**
 * Deduplicate detections across consecutive frames.
 *
 * Tracks potholes across frames by matching bounding boxes with IoU >= threshold.
 * Returns detections with assigned unique pothole IDs.
 *
 * @param frameResults Array of frame detection results
 * @param iouThreshold Minimum IoU to consider as same pothole (0-1, default 0.70)
 * @returns Array of tracked detections with unique pothole assignments
 */
export function deduplicateDetectionsAcrossFrames(
  frameResults: any[],
  iouThreshold: number = 0.70
): {
  trackedDetections: TrackedDetection[];
  uniquePotholeCount: number;
  potholeIdMap: Map<string, string>;  // uniqueId -> canonical ID
} {
  const trackedDetections: TrackedDetection[] = [];
  const potholeIdMap = new Map<string, string>();  // Maps unique IDs to canonical pothole IDs
  let nextUniquePotholeId = 1;

  // Process frames in order
  for (let frameIdx = 0; frameIdx < frameResults.length; frameIdx++) {
    const frameResult = frameResults[frameIdx];
    const predictions = frameResult.predictions || [];

    for (const pred of predictions) {
      const currentBox: BoundingBox = {
        x: pred.x,
        y: pred.y,
        width: pred.width,
        height: pred.height,
      };

      // Try to find a matching detection in the previous frame
      let matchedUniqueId: string | null = null;

      if (frameIdx > 0) {
        const prevFrameResult = frameResults[frameIdx - 1];
        const prevPredictions = prevFrameResult.predictions || [];

        for (const prevPred of prevPredictions) {
          const prevBox: BoundingBox = {
            x: prevPred.x,
            y: prevPred.y,
            width: prevPred.width,
            height: prevPred.height,
          };

          const iou = calculateIoU(currentBox, prevBox);

          // If IoU is above threshold, consider it the same pothole
          if (iou >= iouThreshold) {
            // Get the unique ID assigned to the previous detection
            const prevDetectionKey = `${frameIdx - 1}_${prevPredictions.indexOf(prevPred)}`;
            const prevTracked = trackedDetections.find(
              (t) => t.frameIndex === frameIdx - 1 &&
                     t.prediction === prevPred
            );

            if (prevTracked) {
              matchedUniqueId = prevTracked.uniqueId;
              break;  // Found a match, stop searching
            }
          }
        }
      }

      // If no match found in previous frame, assign a new unique pothole ID
      if (!matchedUniqueId) {
        matchedUniqueId = `pothole_${nextUniquePotholeId}`;
        nextUniquePotholeId++;
      }

      // Track this detection
      const tracked: TrackedDetection = {
        prediction: pred,
        frameIndex: frameIdx,
        timestamp: frameResult.timestamp,
        uniqueId: matchedUniqueId,
      };

      trackedDetections.push(tracked);
    }
  }

  // Count unique potholes (distinct unique IDs)
  const uniqueIds = new Set(trackedDetections.map((t) => t.uniqueId));
  const uniquePotholeCount = uniqueIds.size;

  return {
    trackedDetections,
    uniquePotholeCount,
    potholeIdMap,
  };
}
