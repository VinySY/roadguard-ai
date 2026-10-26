import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BOX_IOU_THRESHOLD,
  DEFAULT_MASK_IOU_THRESHOLD,
  InvalidRoboflowResponseError,
  SanitizedPrediction,
  calculateBoxIoU,
  deduplicatePredictions,
  enrichPredictions,
  filterByConfidence,
  sanitizePrediction,
  validateRoboflowResponse,
} from '../server/utils/detectionPostprocess.js';
import { trackPotholes, TrackFrame } from '../server/utils/potholeTracker.js';
import {
  resolveInspectionUniqueCount,
  resolveRawDetectionCount,
  resolveUniquePotholeCount,
} from '../../frontend/src/services/detectionCounts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE = { width: 500, height: 340 };

function square(left: number, top: number, right: number, bottom: number) {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function prediction(overrides: {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class?: string;
  points?: { x: number; y: number }[];
  detection_id?: string;
}): SanitizedPrediction {
  const sanitized = sanitizePrediction(
    {
      class: overrides.class ?? 'pothole',
      detection_id: overrides.detection_id,
      ...overrides,
    },
    IMAGE,
  );
  assert.ok(sanitized, 'test prediction should sanitize');
  return sanitized;
}

function frame(frameIndex: number, predictions: SanitizedPrediction[]): TrackFrame {
  return {
    frameIndex,
    timestamp: frameIndex,
    predictions,
    image: IMAGE,
  };
}

// ---------------------------------------------------------------------------
// Image regression: real Roboflow output for the provided 3-pothole photo
// ---------------------------------------------------------------------------

test('regression fixture: 5 synonym/duplicate predictions collapse to 3 physical potholes', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'massive-image-response.json');
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const validated = validateRoboflowResponse(raw);
  assert.equal(validated.image.width, 500);
  assert.equal(validated.image.height, 340);
  assert.equal(validated.rawPredictionCount, 5);
  assert.equal(validated.invalidPredictionCount, 0);

  const candidates = filterByConfidence(validated.predictions, 0.2);
  assert.equal(candidates.length, 5);

  const deduped = deduplicatePredictions(candidates);
  assert.equal(deduped.candidateCount, 5);
  assert.equal(deduped.duplicateCount, 2);
  assert.equal(deduped.predictions.length, 3, '3 distinct potholes expected');

  // The three representatives are the two high-confidence real potholes plus
  // the partially visible pothole at the top edge.
  const classes = new Set(deduped.predictions.map((p) => p.class));
  assert.ok(classes.size >= 2, 'class-agnostic dedup should span synonym classes');
  assert.equal(enrichPredictions(deduped.predictions, validated.image).length, 3);
});

test('fixture duplicate pairs really do have near-identical boxes', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'massive-image-response.json');
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const validated = validateRoboflowResponse(raw);

  // Roboflow ordering differs between calls; the duplicate pairs are
  // (highest + third) and (second + fourth) in this captured response.
  const firstPairIou = calculateBoxIoU(validated.predictions[0], validated.predictions[2]);
  const secondPairIou = calculateBoxIoU(validated.predictions[1], validated.predictions[3]);
  const crossPairIou = calculateBoxIoU(validated.predictions[0], validated.predictions[1]);
  assert.equal(crossPairIou, 0, 'the two real potholes must not overlap each other');
  assert.ok(firstPairIou > 0.9, `expected duplicate IoU > 0.9, got ${firstPairIou}`);
  assert.ok(secondPairIou > 0.9, `expected duplicate IoU > 0.9, got ${secondPairIou}`);
  assert.ok(firstPairIou > DEFAULT_BOX_IOU_THRESHOLD);
  assert.ok(secondPairIou > DEFAULT_BOX_IOU_THRESHOLD);
});

// ---------------------------------------------------------------------------
// Within-frame duplicate suppression
// ---------------------------------------------------------------------------

test('overlapping predictions with the same mask are merged once', () => {
  const a = prediction({
    x: 50, y: 50, width: 60, height: 40, confidence: 0.91,
    class: 'Pothole', points: square(20, 30, 80, 70), detection_id: 'a',
  });
  const b = prediction({
    x: 50, y: 50, width: 60, height: 40, confidence: 0.62,
    class: 'potholes', points: square(20, 30, 80, 70), detection_id: 'b',
  });

  const result = deduplicatePredictions([a, b], { maskIouThreshold: DEFAULT_MASK_IOU_THRESHOLD });
  assert.equal(result.predictions.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.predictions[0].detection_id, 'a', 'highest-confidence box wins');
  assert.equal(result.predictions[0].duplicateCount, 1);
  assert.deepEqual(result.predictions[0].mergedDetectionIds, ['b']);
});

test('nested duplicate masks merge via containment but differently-sized objects do not', () => {
  const outer = prediction({
    x: 50, y: 50, width: 80, height: 80, confidence: 0.88,
    points: square(10, 10, 90, 90),
  });
  const nested = prediction({
    x: 50, y: 50, width: 50, height: 50, confidence: 0.55,
    points: square(25, 25, 75, 75),
  });

  const nestedResult = deduplicatePredictions([outer, nested], {
    containmentThreshold: 0.9,
    minAreaRatioForContainment: 0.35,
  });
  assert.equal(nestedResult.predictions.length, 1, 'nested same-object mask should merge');

  const smallSeparate = prediction({
    x: 50, y: 50, width: 8, height: 8, confidence: 0.55,
    points: square(46, 46, 54, 54),
  });
  const tinyResult = deduplicatePredictions([outer, smallSeparate], {
    containmentThreshold: 0.9,
    minAreaRatioForContainment: 0.35,
  });
  assert.equal(
    tinyResult.predictions.length,
    2,
    'a tiny contained speck must not be merged into an unrelated large pothole',
  );
});

test('nearby but separate potholes are not merged', () => {
  const left = prediction({
    x: 20, y: 30, width: 40, height: 40, confidence: 0.82,
    points: square(0, 10, 40, 50),
  });
  const right = prediction({
    x: 70, y: 30, width: 40, height: 40, confidence: 0.80,
    points: square(50, 10, 90, 50),
  });

  const result = deduplicatePredictions([left, right]);
  assert.equal(result.predictions.length, 2);
  assert.equal(result.duplicateCount, 0);
});

test('class synonyms and case differences do not create extra potholes', () => {
  const variants = ['pothole', 'Pothole', 'potholes', 'Potholes', 'object', 'POthole'];
  const predictions = variants.map((className, index) =>
    prediction({
      x: 50, y: 50, width: 40, height: 40,
      confidence: 0.9 - index * 0.04,
      class: className,
      points: square(30, 30, 70, 70),
    }),
  );

  const result = deduplicatePredictions(predictions);
  assert.equal(result.predictions.length, 1);
  assert.equal(result.duplicateCount, variants.length - 1);
});

test('empty and low-confidence results produce zero unique potholes', () => {
  const validatedEmpty = validateRoboflowResponse({ image: { width: 640, height: 480 } });
  assert.equal(validatedEmpty.predictions.length, 0);
  assert.equal(validatedEmpty.rawPredictionCount, 0);

  const low = prediction({
    x: 10, y: 10, width: 20, height: 20, confidence: 0.12,
  });
  const filtered = filterByConfidence([low], 0.2);
  assert.equal(filtered.length, 0);
  assert.equal(deduplicatePredictions(filtered).predictions.length, 0);
});

// ---------------------------------------------------------------------------
// Validation / invalid responses
// ---------------------------------------------------------------------------

test('invalid Roboflow responses are rejected, malformed predictions ignored', () => {
  assert.throws(
    () => validateRoboflowResponse(null),
    (error: unknown) => error instanceof InvalidRoboflowResponseError,
  );
  assert.throws(
    () => validateRoboflowResponse('not-json'),
    (error: unknown) => error instanceof InvalidRoboflowResponseError,
  );

  const partial = validateRoboflowResponse({
    image: { width: 100, height: 100 },
    predictions: [
      { x: 10, y: 10, width: 20, height: 20, confidence: 0.8, class: 'pothole' },
      { x: 'nope', y: 10, width: 20, height: 20, confidence: 0.8 },
      { x: 10, y: 10, width: -4, height: 20, confidence: 0.8 },
      null,
    ],
  });
  assert.equal(partial.predictions.length, 1);
  assert.equal(partial.invalidPredictionCount, 3);
  assert.ok(partial.warnings.some((warning) => warning.includes('malformed')));

  const malformedPredictionsField = validateRoboflowResponse({
    image: { width: 100, height: 100 },
    predictions: 'broken',
  });
  assert.equal(malformedPredictionsField.predictions.length, 0);
  assert.ok(malformedPredictionsField.warnings.some((warning) => warning.includes('malformed predictions')));
});

// ---------------------------------------------------------------------------
// Multi-frame tracking
// ---------------------------------------------------------------------------

test('same pothole across frames is counted once', () => {
  const frames: TrackFrame[] = [0, 1, 2, 3].map((index) =>
    frame(index, [
      prediction({
        x: 100 + index * 6,
        y: 100 + index * 2,
        width: 50,
        height: 40,
        confidence: 0.8,
        points: square(75 + index * 6, 80 + index * 2, 125 + index * 6, 120 + index * 2),
      }),
    ]),
  );

  const result = trackPotholes(frames);
  assert.equal(result.uniquePotholeCount, 1);
  assert.equal(result.confirmedTracks[0].hits, 4);
  assert.equal(result.representativeDetections.length, 1);
});

test('simultaneous potholes keep one-to-one identities', () => {
  const frames: TrackFrame[] = [0, 1, 2, 3].map((index) =>
    frame(index, [
      prediction({ x: 60 + index * 2, y: 60, width: 40, height: 30, confidence: 0.85 }),
      prediction({ x: 250 + index * 2, y: 180, width: 45, height: 35, confidence: 0.78 }),
    ]),
  );

  const result = trackPotholes(frames);
  assert.equal(result.uniquePotholeCount, 2);
  assert.equal(result.totalTracks, 2);
  assert.ok(result.confirmedTracks.every((track) => track.hits === 4));
  assert.equal(new Set(result.confirmedTracks.map((track) => track.trackId)).size, 2);
});

test('temporary disappearance within maxMissedFrames keeps the same track', () => {
  const visible = (index: number) =>
    frame(index, [
      prediction({ x: 120, y: 90, width: 40, height: 30, confidence: 0.75 }),
    ]);
  const frames: TrackFrame[] = [
    visible(0),
    frame(1, []), // occlusion / missed detection
    visible(2),
    visible(3),
  ];

  const result = trackPotholes(frames, { maxMissedFrames: 3, minHits: 2 });
  assert.equal(result.uniquePotholeCount, 1);
  assert.equal(result.confirmedTracks[0].hits, 3);
  assert.equal(result.confirmedTracks[0].missed, 0);
});

test('a track longer than maxMissedFrames is split rather than merged forever', () => {
  const frames: TrackFrame[] = [
    frame(0, [prediction({ x: 120, y: 90, width: 40, height: 30, confidence: 0.75 })]),
    frame(1, []),
    frame(2, []),
    frame(3, []),
    frame(4, [prediction({ x: 120, y: 90, width: 40, height: 30, confidence: 0.75 })]),
    frame(5, [prediction({ x: 120, y: 90, width: 40, height: 30, confidence: 0.75 })]),
  ];

  const result = trackPotholes(frames, { maxMissedFrames: 1, minHits: 2 });
  assert.equal(result.totalTracks, 2);
  // The second pair is confirmed; the first was only seen once.
  assert.equal(result.uniquePotholeCount, 1);
  assert.equal(result.tentativePotholeCount, 1);
});

test('camera movement and scale change still associate the pothole', () => {
  const frames: TrackFrame[] = [0, 1, 2, 3].map((index) => {
    const scale = 1 + index * 0.12;
    const width = 50 * scale;
    const height = 40 * scale;
    return frame(index, [
      prediction({
        x: 100 + index * 18,
        y: 100 + index * 8,
        width,
        height,
        confidence: 0.8,
      }),
    ]);
  });

  const result = trackPotholes(frames, { maxMissedFrames: 2, minHits: 2 });
  assert.equal(result.uniquePotholeCount, 1);
});

test('spurious single-frame detections are tentative, not part of the unique count', () => {
  const frames: TrackFrame[] = [
    frame(0, []),
    frame(1, [prediction({ x: 80, y: 80, width: 30, height: 25, confidence: 0.55 })]),
    frame(2, []),
    frame(3, []),
  ];

  const result = trackPotholes(frames, { minHits: 2 });
  assert.equal(result.uniquePotholeCount, 0);
  assert.equal(result.tentativePotholeCount, 1);
  assert.equal(result.singleFrameTrackCount, 1);
  assert.equal(result.quality.level, 'low');
  assert.ok(result.limitations.length > 0);
});

test('too-short / empty video samples report low quality and zero unique potholes', () => {
  const emptyResult = trackPotholes([]);
  assert.equal(emptyResult.uniquePotholeCount, 0);
  assert.equal(emptyResult.quality.level, 'low');
  assert.ok(emptyResult.limitations.some((limitation) => limitation.toLowerCase().includes('frame')));

  const single = trackPotholes([
    frame(0, [
      prediction({ x: 30, y: 30, width: 40, height: 30, confidence: 0.9 }),
      prediction({ x: 200, y: 100, width: 40, height: 30, confidence: 0.85 }),
    ]),
  ]);
  assert.equal(single.uniquePotholeCount, 2);
  assert.equal(single.quality.level, 'low');
  assert.ok(single.limitations.some((limitation) => limitation.includes('few frames')));
});

// ---------------------------------------------------------------------------
// Full video counting pipeline (per-frame dedup → cross-frame tracking)
// ---------------------------------------------------------------------------

test('synthetic 3-frame clip: 18 raw synonym predictions collapse to 2 unique potholes', () => {
  let rawPredictionCount = 0;
  const frames: TrackFrame[] = [0, 1, 2].map((frameIndex) => {
    // Two real potholes. The model emits three synonym/overlapping boxes for
    // each pothole in every frame (6 predictions/frame).
    const raw = [
      { x: 100, y: 100, width: 50, height: 40, c: 0.86, cls: 'pothole' },
      { x: 101, y: 100, width: 51, height: 41, c: 0.64, cls: 'Pothole' },
      { x: 100, y: 101, width: 50, height: 40, c: 0.41, cls: 'potholes' },
      { x: 300, y: 150, width: 60, height: 45, c: 0.90, cls: 'Pothole' },
      { x: 299, y: 151, width: 62, height: 44, c: 0.58, cls: 'object' },
      { x: 300, y: 150, width: 61, height: 46, c: 0.37, cls: 'pothole' },
    ].map((entry) =>
      prediction({
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
        confidence: entry.c,
        class: entry.cls,
      }),
    );

    rawPredictionCount += raw.length;
    const perFrame = deduplicatePredictions(raw);
    assert.equal(perFrame.predictions.length, 2, 'each frame should report 2 unique potholes');
    return frame(frameIndex, perFrame.predictions);
  });

  const tracking = trackPotholes(frames);
  assert.equal(rawPredictionCount, 18);
  assert.equal(tracking.uniquePotholeCount, 2);
  assert.equal(tracking.confirmedTracks.length, 2);
  assert.ok(tracking.confirmedTracks.every((track) => track.hits === 3));

  // Backend payload + frontend helper must agree on both counts.
  const payload = {
    analytics: {
      uniquePotholeCount: tracking.uniquePotholeCount,
      totalDetected: tracking.uniquePotholeCount,
      rawDetectionCount: rawPredictionCount,
      totalDetections: rawPredictionCount,
      duplicatePredictionsRemoved: rawPredictionCount - tracking.uniquePotholeCount,
    },
  };
  assert.equal(resolveUniquePotholeCount(payload), 2);
  assert.equal(resolveRawDetectionCount(payload), 18);

  assert.equal(
    resolveInspectionUniqueCount({ detection_count: 18, unique_pothole_count: 2 }),
    2,
  );
  assert.equal(resolveInspectionUniqueCount({ detection_count: 7, unique_pothole_count: null }), 7);
  assert.equal(resolveInspectionUniqueCount(null), 0);
});
