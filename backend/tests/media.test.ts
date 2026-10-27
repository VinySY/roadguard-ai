import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoadIssue } from '../server/validation.js';
import { toPublicUploadUrl } from '../server/utils/uploads.js';
import { buildVideoDetectionMetadata } from '../server/routes/videoDetection.js';
import {
  boxesFromStoredDetections,
  buildInspectionDetection,
  findClosestVideoFrame,
} from '../../frontend/src/services/annotations.ts';

const BASE_ISSUE = {
  category: 'Pothole',
  description: 'Large cavity in the wheel path.',
  severity: 'high',
};

const VALID_METADATA = {
  potholeCount: 1,
  boxes: [
    {
      id: 'det-1',
      x: 0.4,
      y: 0.4,
      width: 0.2,
      height: 0.2,
      confidence: 0.91,
      class: 'pothole',
      points: [
        { x: 400, y: 200 },
        { x: 600, y: 200 },
        { x: 600, y: 300 },
        { x: 400, y: 300 },
      ],
    },
  ],
  videoUrl: '/api/uploads/videos/clip.mp4',
  video: {
    url: '/api/uploads/videos/clip.mp4',
    path: 'uploads/videos/clip.mp4',
    width: 1000,
    height: 500,
  },
  videoFrames: [
    {
      frameIndex: 0,
      timestamp: 0,
      boxes: [
        {
          x: 0.4,
          y: 0.4,
          width: 0.2,
          height: 0.2,
          confidence: 0.91,
          class: 'pothole',
          points: null,
        },
      ],
    },
  ],
};

test('validateRoadIssue accepts persisted video media and compact detector metadata', () => {
  const result = validateRoadIssue({
    ...BASE_ISSUE,
    media_type: 'video',
    evidence_video_path: 'uploads/videos/clip.mp4',
    detection_metadata: VALID_METADATA,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.media_type, 'video');
  assert.equal(result.data?.evidence_video_path, 'uploads/videos/clip.mp4');
  assert.deepEqual(result.data?.detection_metadata, VALID_METADATA);
});

test('validateRoadIssue parses JSON metadata from multipart form submissions', () => {
  const result = validateRoadIssue({
    ...BASE_ISSUE,
    detection_metadata: JSON.stringify(VALID_METADATA),
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.data?.detection_metadata, VALID_METADATA);
  assert.equal(result.data?.media_type, 'image');
});

test('validateRoadIssue infers video media when only the video path is supplied', () => {
  const result = validateRoadIssue({
    ...BASE_ISSUE,
    evidence_video_path: 'uploads/videos/clip.mp4',
  });

  assert.equal(result.valid, true);
  assert.equal(result.data?.media_type, 'video');
});

test('validateRoadIssue rejects session-only media URLs', () => {
  const blobResult = validateRoadIssue({
    ...BASE_ISSUE,
    evidence_video_path: 'blob:https://roadguard.test/1234',
  });
  assert.equal(blobResult.valid, false);
  assert.ok(blobResult.errors.some((error) => error.field === 'evidence_video_path'));

  const dataResult = validateRoadIssue({
    ...BASE_ISSUE,
    evidence_path: 'data:image/jpeg;base64,AAAA',
  });
  assert.equal(dataResult.valid, false);
  assert.ok(dataResult.errors.some((error) => error.field === 'evidence_path'));
});

test('validateRoadIssue strips session blob URLs from metadata but keeps geometry', () => {
  const result = validateRoadIssue({
    ...BASE_ISSUE,
    detection_metadata: {
      ...VALID_METADATA,
      imageUrl: 'blob:https://roadguard.test/preview',
      videoUrl: 'blob:https://roadguard.test/video',
      video: {
        ...VALID_METADATA.video,
        url: 'blob:https://roadguard.test/video',
      },
    },
  });

  assert.equal(result.valid, true);
  const metadata = result.data?.detection_metadata as Record<string, any>;
  assert.equal(metadata.imageUrl, undefined);
  assert.equal(metadata.videoUrl, undefined);
  assert.equal(metadata.video.url, undefined);
  assert.equal(metadata.video.path, 'uploads/videos/clip.mp4');
  assert.equal(metadata.boxes[0].x, 0.4);
  assert.equal(metadata.videoFrames[0].timestamp, 0);
});

test('validateRoadIssue strips inline data media but rejects malformed metadata', () => {
  const traversal = validateRoadIssue({
    ...BASE_ISSUE,
    evidence_video_path: 'uploads/videos/../../server/.env',
  });
  assert.equal(traversal.valid, false);
  assert.ok(traversal.errors.some((error) => error.field === 'evidence_video_path'));

  const inline = validateRoadIssue({
    ...BASE_ISSUE,
    detection_metadata: {
      boxes: [],
      thumbnail: 'data:image/jpeg;base64,AAAA',
    },
  });
  assert.equal(inline.valid, true);
  assert.equal((inline.data?.detection_metadata as Record<string, any>).thumbnail, undefined);

  const oversized = validateRoadIssue({
    ...BASE_ISSUE,
    detection_metadata: { padding: 'x'.repeat(1_000_001) },
  });
  assert.equal(oversized.valid, false);
  assert.ok(oversized.errors.some((error) => error.field === 'detection_metadata'));

  const notJson = validateRoadIssue({
    ...BASE_ISSUE,
    detection_metadata: '{not-json',
  });
  assert.equal(notJson.valid, false);
  assert.ok(notJson.errors.some((error) => error.field === 'detection_metadata'));
});

test('validateRoadIssue rejects unsupported media types', () => {
  const result = validateRoadIssue({ ...BASE_ISSUE, media_type: 'audio' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.field === 'media_type'));
});

test('toPublicUploadUrl exposes stored media and refuses inline blobs', () => {
  assert.equal(
    toPublicUploadUrl('uploads/videos/clip.mp4'),
    '/api/uploads/videos/clip.mp4'
  );
  assert.equal(
    toPublicUploadUrl('/api/uploads/videos/clip.mp4'),
    '/api/uploads/videos/clip.mp4'
  );
  assert.equal(toPublicUploadUrl('blob:https://roadguard.test/1'), null);
  assert.equal(toPublicUploadUrl('data:video/webm;base64,AAAA'), null);
});

test('buildVideoDetectionMetadata normalizes centre pixel boxes to UI geometry', () => {
  const metadata = buildVideoDetectionMetadata({
    video: {
      filename: 'clip.mp4',
      duration: 4,
      width: 1000,
      height: 500,
      fps: 30,
      codec: 'h264',
      url: '/api/uploads/videos/clip.mp4',
      path: 'uploads/videos/clip.mp4',
    },
    image: { width: 1000, height: 500 },
    frames: [
      {
        frameIndex: 0,
        timestamp: 0,
        image: { width: 1000, height: 500 },
        model: { id: 'test-model', taskType: 'instance-segmentation' },
        predictions: [
          {
            x: 500,
            y: 250,
            width: 200,
            height: 100,
            confidence: 0.91,
            class: 'pothole',
            points: [
              { x: 400, y: 200 },
              { x: 600, y: 200 },
              { x: 600, y: 300 },
              { x: 400, y: 300 },
            ],
            severity: 'high',
          },
        ],
        analytics: {
          totalDetected: 1,
          uniquePotholeCount: 1,
          rawDetectionCount: 1,
          rawPredictionCount: 1,
          duplicatePredictionsRemoved: 0,
          maxConfidence: 0.91,
          damagePercentage: 4,
          overallRiskLevel: 'HIGH',
        },
      },
    ] as any,
    uniquePotholeCount: 1,
    rawDetectionCount: 1,
    maxConfidence: 0.91,
    averageDamage: 4,
    overallRiskLevel: 'HIGH',
  });

  const frame = metadata.videoFrames[0];
  assert.equal(frame.timestamp, 0);
  assert.equal(frame.boxes.length, 1);
  assert.equal(frame.boxes[0].x, 0.4);
  assert.equal(frame.boxes[0].y, 0.4);
  assert.equal(frame.boxes[0].width, 0.2);
  assert.equal(frame.boxes[0].height, 0.2);
  assert.deepEqual(frame.boxes[0].points, [
    { x: 400, y: 200 },
    { x: 600, y: 200 },
    { x: 600, y: 300 },
    { x: 400, y: 300 },
  ]);
  assert.equal(metadata.videoUrl, '/api/uploads/videos/clip.mp4');
  assert.equal(metadata.video?.path, 'uploads/videos/clip.mp4');
  assert.equal(metadata.videoFrames.length, 1);
});

test('boxesFromStoredDetections converts centre-based rows and skips invalid geometry', () => {
  const boxes = boxesFromStoredDetections(
    [
      {
        class_name: 'pothole',
        confidence: '0.8',
        severity: 'high',
        x: '500',
        y: '250',
        width: '200',
        height: '100',
        polygon_points: [
          { x: 400, y: 200 },
          { x: 600, y: 200 },
          { x: 600, y: 300 },
        ],
      },
      {
        class_name: 'pothole',
        confidence: 0.4,
        x: 10,
        y: 10,
        width: 0,
        height: 20,
      },
    ],
    1000,
    500
  );

  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].x, 0.4);
  assert.equal(boxes[0].y, 0.4);
  assert.equal(boxes[0].width, 0.2);
  assert.equal(boxes[0].height, 0.2);
  assert.equal(boxes[0].confidence, 0.8);
  assert.equal(boxes[0].points?.length, 3);
});

test('buildInspectionDetection reads JSON metadata strings before falling back to rows', () => {
  const fromMetadata = buildInspectionDetection(
    {
      image_width: 1000,
      image_height: 500,
      media_type: 'video',
      detection_metadata: JSON.stringify(VALID_METADATA),
    },
    []
  );
  assert.equal(fromMetadata?.videoUrl, '/api/uploads/videos/clip.mp4');
  assert.equal(fromMetadata?.videoFrames?.[0].boxes.length, 1);

  const fromRows = buildInspectionDetection(
    {
      image_width: 1000,
      image_height: 500,
      overall_risk: 'HIGH',
      detection_count: 2,
      unique_pothole_count: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    [
      {
        class_name: 'pothole',
        confidence: 0.8,
        severity: 'high',
        x: 500,
        y: 250,
        width: 200,
        height: 100,
      },
    ]
  );
  assert.equal(fromRows?.potholeCount, 1);
  assert.equal(fromRows?.boxes[0].x, 0.4);
  assert.equal(fromRows?.severity, 'high');
});

test('findClosestVideoFrame only returns frames within the tolerance window', () => {
  const frames = [
    { frameIndex: 0, timestamp: 0, boxes: [] },
    { frameIndex: 1, timestamp: 2.5, boxes: [] },
  ];

  assert.equal(findClosestVideoFrame(frames, 2.6)?.frameIndex, 1);
  assert.equal(findClosestVideoFrame(frames, 1.25), null);
  assert.equal(findClosestVideoFrame([], 0), null);
});
