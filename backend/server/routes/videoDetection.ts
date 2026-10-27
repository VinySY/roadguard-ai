import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { getPool } from '../db/pool.js';
import { saveInspection, saveDetections } from '../db/persistence.js';
import { getProjectRoot, getUploadsRoot } from '../utils/paths.js';
import { toPublicUploadUrl } from '../utils/uploads.js';
import {
  buildServerlessInferenceUrl,
  getRoboflowConfig,
  sanitizeApiKey,
} from '../config/roboflow.js';
import type { EnrichedPrediction } from '../utils/detectionPostprocess.js';
import {
  DEFAULT_BOX_IOU_THRESHOLD,
  DEFAULT_CONFIDENCE_PERCENT,
  DEFAULT_CONTAINMENT_THRESHOLD,
  DEFAULT_MASK_IOU_THRESHOLD,
  DEFAULT_MIN_AREA_RATIO_FOR_CONTAINMENT,
  DEFAULT_OVERLAP_PERCENT,
  InvalidRoboflowResponseError,
  calculateDamagePercentage,
  calculateRiskLevel,
  deduplicatePredictions,
  enrichPredictions,
  filterByConfidence,
  maxConfidenceOf,
  parseBooleanParam,
  parseIntegerParam,
  parsePercentParam,
  parseUnitIntervalParam,
  validateRoboflowResponse,
} from '../utils/detectionPostprocess.js';
import { summarizeTracks, trackPotholes } from '../utils/potholeTracker.js';
import type { TrackFrame, TrackingResult } from '../utils/potholeTracker.js';
import { planFrameExtraction } from '../utils/videoSampling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = getProjectRoot(__dirname);
const uploadsRoot = getUploadsRoot(projectRoot);

// Configure FFmpeg binary:
// 1. Explicit FFMPEG_PATH env var if provided
// 2. On non-Windows containers without system ffmpeg, use ffmpegStatic
// 3. Otherwise default to system PATH (default fluent-ffmpeg behavior, proven on Windows & Docker)
try {
  if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    console.log(`[RoadGuard Video] Using FFmpeg from FFMPEG_PATH: ${process.env.FFMPEG_PATH}`);
  } else if (process.platform !== 'win32' && ffmpegStatic && typeof ffmpegStatic === 'string') {
    ffmpeg.setFfmpegPath(ffmpegStatic);
  }
} catch (e: any) {
  console.warn('[RoadGuard Video] Could not set custom FFmpeg path, defaulting to system PATH:', e?.message || e);
}

if (process.env.FFPROBE_PATH) {
  try {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
    console.log(`[RoadGuard Video] Using FFprobe from FFPROBE_PATH: ${process.env.FFPROBE_PATH}`);
  } catch (e: any) {
    console.warn('[RoadGuard Video] Could not set custom FFprobe path:', e?.message || e);
  }
}

const router = Router();

// ==========================================
// Configuration
// ==========================================

const roboflowConfig = getRoboflowConfig();

/** Maximum video file size (50 MB) */
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

/** Absolute upper bound accepted from clients/env (protects Roboflow quota). */
const MAX_SUPPORTED_FRAMES = 300;

/**
 * Default frame cap. 60 frames covers a one-minute video at 1 fps, including
 * the 40.3 s regression clip. Override with MAX_VIDEO_FRAMES (bounded by
 * MAX_SUPPORTED_FRAMES); clients may also pass `maxFrames` per request.
 */
const DEFAULT_MAX_FRAMES = (() => {
  const configured = parseInt(process.env.MAX_VIDEO_FRAMES ?? '', 10);
  if (Number.isInteger(configured) && configured > 0) {
    return Math.min(configured, MAX_SUPPORTED_FRAMES);
  }
  return 60;
})();

/** Default frames per second to extract */
const DEFAULT_FPS = 1;

/** Extraction fps bounds */
const MIN_EXTRACTION_FPS = 0.1;
const MAX_EXTRACTION_FPS = 5;

/**
 * Tracker strong-overlap threshold. Deliberately lower than the old 0.70:
 * dashcam footage moves between samples, so exact IoU is rare. Motion
 * compensation and a centre-distance gate provide the rest of the association
 * signal.
 */
const DEFAULT_TRACK_MATCH_IOU = 0.2;

/** Allow a track to survive this many consecutive sampled frames without a hit. */
const DEFAULT_MAX_MISSED_FRAMES = 3;

interface VideoDetectionOptions {
  confidence: number;
  overlap: number;
  extractionFps: number;
  /** True when the requested fps was above MAX_EXTRACTION_FPS and clamped. */
  fpsCapped: boolean;
  /** Maximum frames to extract and analyse for this request. */
  maxFrames: number;
  dedupeEnabled: boolean;
  maskIou: number;
  boxIou: number;
  containment: number;
  minAreaRatio: number;
  matchIou: number;
  maxMissedFrames: number;
  minHits: number | null;
  debug: boolean;
}

function parseExtractionFps(value: unknown): { fps: number; capped: boolean } | null {
  if (value === undefined || value === null || value === '') {
    return { fps: DEFAULT_FPS, capped: false };
  }
  if (Array.isArray(value)) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return {
    fps: Math.max(MIN_EXTRACTION_FPS, Math.min(parsed, MAX_EXTRACTION_FPS)),
    capped: parsed > MAX_EXTRACTION_FPS,
  };
}

/**
 * Parses and validates every query option BEFORE multer writes the upload to
 * disk. Invalid values return 400 instead of silently producing NaN / NaI
 * counts downstream.
 */
function parseVideoOptions(req: Request): { options?: VideoDetectionOptions; error?: string } {
  const confidence = parsePercentParam(req.query.confidence, DEFAULT_CONFIDENCE_PERCENT);
  if (confidence === null) {
    return { error: 'Invalid confidence value. Provide a number between 0 and 100.' };
  }

  const overlap = parsePercentParam(req.query.overlap, DEFAULT_OVERLAP_PERCENT);
  if (overlap === null) {
    return { error: 'Invalid overlap value. Provide a number between 0 and 100.' };
  }

  const extractionFps = parseExtractionFps(req.query.fps);
  if (extractionFps === null) {
    return { error: `Invalid fps value. Provide a positive number (server maximum ${MAX_EXTRACTION_FPS}).` };
  }

  const maxFrames = parseIntegerParam(
    req.query.maxFrames,
    DEFAULT_MAX_FRAMES,
    1,
    MAX_SUPPORTED_FRAMES,
  );
  if (maxFrames === null) {
    return { error: `Invalid maxFrames value. Provide an integer between 1 and ${MAX_SUPPORTED_FRAMES}.` };
  }

  const maskIou = parseUnitIntervalParam(
    req.query.maskIou ?? req.query.dedupeIou,
    DEFAULT_MASK_IOU_THRESHOLD,
  );
  if (maskIou === null) {
    return { error: 'Invalid maskIou value. Provide a number between 0 and 1.' };
  }

  const boxIou = parseUnitIntervalParam(
    req.query.boxIou ?? req.query.dedupeBoxIou,
    DEFAULT_BOX_IOU_THRESHOLD,
  );
  if (boxIou === null) {
    return { error: 'Invalid boxIou value. Provide a number between 0 and 1.' };
  }

  const containment = parseUnitIntervalParam(
    req.query.containment,
    DEFAULT_CONTAINMENT_THRESHOLD,
  );
  if (containment === null) {
    return { error: 'Invalid containment value. Provide a number between 0 and 1.' };
  }

  const minAreaRatio = parseUnitIntervalParam(
    req.query.minAreaRatio,
    DEFAULT_MIN_AREA_RATIO_FOR_CONTAINMENT,
  );
  if (minAreaRatio === null) {
    return { error: 'Invalid minAreaRatio value. Provide a number between 0 and 1.' };
  }

  // `iou` is kept for backwards compatibility with older clients and is now
  // the tracker's strong-overlap threshold. `matchIou` is the explicit alias.
  const matchIou = parseUnitIntervalParam(
    req.query.matchIou ?? req.query.iou,
    DEFAULT_TRACK_MATCH_IOU,
  );
  if (matchIou === null) {
    return { error: 'Invalid iou value. Provide a number between 0 and 1.' };
  }

  const maxMissedFrames = parseIntegerParam(
    req.query.maxMissed ?? req.query.maxMissedFrames,
    DEFAULT_MAX_MISSED_FRAMES,
    0,
    30,
  );
  if (maxMissedFrames === null) {
    return { error: 'Invalid maxMissed value. Provide an integer between 0 and 30.' };
  }

  const minHits = parseIntegerParam(req.query.minHits, null, 1, MAX_SUPPORTED_FRAMES);
  if (minHits === null && req.query.minHits !== undefined) {
    return { error: `Invalid minHits value. Provide an integer between 1 and ${MAX_SUPPORTED_FRAMES}.` };
  }

  return {
    options: {
      confidence,
      overlap,
      extractionFps: extractionFps.fps,
      fpsCapped: extractionFps.capped,
      maxFrames,
      dedupeEnabled: parseBooleanParam(req.query.dedupe ?? req.query.deduplicate, true),
      maskIou,
      boxIou,
      containment,
      minAreaRatio,
      matchIou,
      maxMissedFrames,
      minHits,
      debug: parseBooleanParam(req.query.debug, false),
    },
  };
}

// Video upload via Multer — disk storage for FFmpeg access
const videoUploadsDir = join(uploadsRoot, 'videos');
if (!fs.existsSync(videoUploadsDir)) {
  fs.mkdirSync(videoUploadsDir, { recursive: true });
}

const framesDir = join(uploadsRoot, 'frames');
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videoUploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',   // .mov
      'video/x-msvideo',   // .avi
      'video/x-matroska',  // .mkv
    ];
    // Also accept by extension as a fallback (some systems send generic MIME)
    const allowedExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const ext = '.' + (file.originalname.split('.').pop()?.toLowerCase() || '');

    if (allowedTypes.includes(file.mimetype.toLowerCase()) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, MOV, AVI, and MKV videos are allowed.'));
    }
  },
});

// ==========================================
// Helper: Get video metadata
// ==========================================

interface VideoMeta {
  duration: number;   // seconds
  width: number;
  height: number;
  fps: number;
  codec: string;
}

function getVideoMetadata(filePath: string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found in file'));

      const duration = metadata.format.duration || 0;
      const width = videoStream.width || 0;
      const height = videoStream.height || 0;

      // Parse frame rate from r_frame_rate (e.g. "30/1" or "29.97")
      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        fps = parts.length === 2
          ? parseInt(parts[0]) / parseInt(parts[1])
          : parseFloat(videoStream.r_frame_rate);
      }

      resolve({
        duration,
        width,
        height,
        fps: Math.round(fps),
        codec: videoStream.codec_name || 'unknown',
      });
    });
  });
}

// ==========================================
// Helper: Extract frames from video
// ==========================================

interface FrameExtractionResult {
  framePaths: string[];
  sessionDir: string;
}

function extractFrames(
  videoPath: string,
  sessionId: string,
  fps: number,
  maxFrames: number
): Promise<FrameExtractionResult> {
  return new Promise((resolve, reject) => {
    const sessionDir = join(framesDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const outputPattern = join(sessionDir, 'frame_%04d.jpg');

    ffmpeg(videoPath)
      .outputOptions([
        `-vf`, `fps=${fps}`,
        `-frames:v`, `${maxFrames}`,
        `-q:v`, `2`,  // High quality JPEG
      ])
      .output(outputPattern)
      .on('end', () => {
        // Collect extracted frame paths
        const files = fs.readdirSync(sessionDir)
          .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
          .sort()
          .map(f => join(sessionDir, f));

        resolve({ framePaths: files, sessionDir });
      })
      .on('error', (err) => {
        reject(new Error(`Frame extraction failed: ${err.message}`));
      })
      .run();
  });
}

// ==========================================
// Helper: Detect potholes in a single frame
// ==========================================

interface ResolvedModelInfo {
  id: string;
  taskType: string;
  packageId?: string;
  backend?: string;
  quantization?: string;
}

interface FrameDetectionResult {
  frameIndex: number;
  timestamp: number;  // seconds into the video
  image: { width: number; height: number };
  model: ResolvedModelInfo;
  predictions: EnrichedPrediction[];
  analytics: {
    /** Final per-frame unique count after duplicate suppression. */
    totalDetected: number;
    uniquePotholeCount: number;
    /** Confidence-filtered model predictions before duplicate suppression. */
    rawDetectionCount: number;
    /** Every prediction returned by the model, including below-threshold ones. */
    rawPredictionCount: number;
    duplicatePredictionsRemoved: number;
    maxConfidence: number;
    damagePercentage: number;
    overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  warnings?: string[];
}

async function detectFrame(
  framePath: string,
  frameIndex: number,
  extractionFps: number,
  apiKey: string,
  fallbackImage: { width: number; height: number },
  options: VideoDetectionOptions,
): Promise<FrameDetectionResult> {
  const imageBuffer = fs.readFileSync(framePath);
  const base64Image = imageBuffer.toString('base64');

  const roboflowUrl = buildServerlessInferenceUrl(roboflowConfig.modelId, {
    confidencePercent: options.confidence,
    overlapPercent: options.overlap,
  });

  let rfResponse;
  try {
    rfResponse = await fetch(roboflowUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: base64Image,
      signal: AbortSignal.timeout(90_000),
    });
  } catch (fetchError: any) {
    if (fetchError?.name === 'TimeoutError' || fetchError?.name === 'AbortError') {
      throw new Error('Roboflow request timed out after 90s.');
    }
    throw new Error(`Could not reach Roboflow: ${fetchError?.message || fetchError}`);
  }

  if (!rfResponse.ok) {
    const errorText = await rfResponse.text();
    throw new Error(`Roboflow API error (${rfResponse.status}): ${errorText}`);
  }

  let result: unknown;
  try {
    result = await rfResponse.json();
  } catch {
    throw new InvalidRoboflowResponseError('The model returned a non-JSON response.');
  }

  const validated = validateRoboflowResponse(result, fallbackImage);
  const resolvedModel = (result as any)?.resolved_model;
  const model: ResolvedModelInfo = {
    id: resolvedModel?.model_id || roboflowConfig.modelId,
    taskType: roboflowConfig.taskType,
    ...(resolvedModel?.model_package_id && { packageId: resolvedModel.model_package_id }),
    ...(resolvedModel?.backend && { backend: resolvedModel.backend }),
    ...(resolvedModel?.quantization && { quantization: resolvedModel.quantization }),
  };
  const candidates = filterByConfidence(validated.predictions, options.confidence / 100);

  const deduplication = options.dedupeEnabled
    ? deduplicatePredictions(candidates, {
        maskIouThreshold: options.maskIou,
        boxIouThreshold: options.boxIou,
        containmentThreshold: options.containment,
        minAreaRatioForContainment: options.minAreaRatio,
      })
    : {
        predictions: candidates,
        candidateCount: candidates.length,
        duplicateCount: 0,
        suppressed: [],
      };

  const enrichedPredictions = enrichPredictions(deduplication.predictions, validated.image);
  const maxConfidence = maxConfidenceOf(deduplication.predictions);
  const damagePercentage = calculateDamagePercentage(deduplication.predictions, validated.image);

  const warnings = [...validated.warnings];
  if (deduplication.duplicateCount > 0) {
    warnings.push(
      `${deduplication.duplicateCount} duplicate/overlapping prediction(s) merged within this frame.`,
    );
  }

  return {
    frameIndex,
    timestamp: parseFloat((frameIndex / extractionFps).toFixed(2)),
    image: validated.image,
    model,
    predictions: enrichedPredictions,
    analytics: {
      totalDetected: enrichedPredictions.length,
      uniquePotholeCount: enrichedPredictions.length,
      rawDetectionCount: candidates.length,
      rawPredictionCount: validated.rawPredictionCount,
      duplicatePredictionsRemoved: deduplication.duplicateCount,
      maxConfidence: parseFloat(maxConfidence.toFixed(3)),
      damagePercentage,
      overallRiskLevel: calculateRiskLevel(enrichedPredictions.length, damagePercentage),
    },
    ...(warnings.length > 0 && { warnings }),
  };
}

// ==========================================
// Helper: Clean up temporary files
// ==========================================

function cleanupFiles(paths: string[]): void {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          fs.unlinkSync(p);
        }
      }
    } catch {
      // Non-critical cleanup failures
    }
  }
}

const RISK_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type RiskLevel = (typeof RISK_ORDER)[number];

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

function annotationSeverity(value?: string): 'low' | 'medium' | 'high' | 'critical' {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'moderate' || normalized === 'medium') return 'medium';
  return 'low';
}

function severityFromRiskLevel(risk: RiskLevel): 'low' | 'medium' | 'high' | 'critical' {
  return risk.toLowerCase() as 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Persists the detector output in the same geometry the UI overlays consume:
 * boxes are normalised top-left coordinates and polygon points stay in the
 * original pixel space for the SVG viewBox. Nothing is synthesised.
 */
export function buildVideoDetectionMetadata(params: {
  video: VideoMeta & { filename: string; url: string; path: string };
  image: { width: number; height: number };
  frames: FrameDetectionResult[];
  uniquePotholeCount: number;
  rawDetectionCount: number;
  maxConfidence: number;
  averageDamage: number;
  overallRiskLevel: RiskLevel;
}) {
  const { video, image, frames, uniquePotholeCount, rawDetectionCount, maxConfidence, averageDamage, overallRiskLevel } = params;

  const mapBoxes = (predictions: EnrichedPrediction[]) =>
    predictions.map((prediction) => {
      const boxWidth = prediction.width || 0;
      const boxHeight = prediction.height || 0;
      const leftPx = (prediction.x || 0) - boxWidth / 2;
      const topPx = (prediction.y || 0) - boxHeight / 2;
      return {
        id: (prediction as any).detection_id || undefined,
        x: image.width > 0 ? Math.max(0, Math.min(1, leftPx / image.width)) : 0,
        y: image.height > 0 ? Math.max(0, Math.min(1, topPx / image.height)) : 0,
        width: image.width > 0 ? Math.max(0, Math.min(1, boxWidth / image.width)) : 0,
        height: image.height > 0 ? Math.max(0, Math.min(1, boxHeight / image.height)) : 0,
        confidence: prediction.confidence || 0,
        class: prediction.class || 'pothole',
        points: prediction.points || null,
        severity: annotationSeverity((prediction as any).severity),
        rawX: prediction.x || 0,
        rawY: prediction.y || 0,
        rawWidth: boxWidth,
        rawHeight: boxHeight,
        imageWidth: image.width,
        imageHeight: image.height,
      };
    });

  const videoFrames = frames.map((frame) => ({
    frameIndex: frame.frameIndex,
    timestamp: frame.timestamp,
    boxes: mapBoxes(frame.predictions),
  }));
  const primaryFrame = videoFrames.find((frame) => frame.boxes.length > 0);

  return {
    potholeCount: uniquePotholeCount,
    uniquePotholeCount,
    rawDetectionCount,
    severity: severityFromRiskLevel(overallRiskLevel),
    confidence: maxConfidence,
    boxes: primaryFrame?.boxes || [],
    image,
    video: {
      filename: video.filename,
      duration: video.duration,
      width: video.width,
      height: video.height,
      fps: video.fps,
      url: video.url,
      path: video.path,
    },
    videoUrl: video.url,
    videoFrames,
    analytics: {
      totalDetected: uniquePotholeCount,
      totalDetections: rawDetectionCount,
      uniquePotholeCount,
      rawDetectionCount,
      maxConfidence,
      damagePercentage: averageDamage,
      overallRiskLevel,
    },
    processedAt: new Date().toISOString(),
    recommendedAction:
      uniquePotholeCount === 0
        ? 'No road defects detected across video frames'
        : overallRiskLevel === 'CRITICAL'
        ? 'Urgent municipal field dispatch required for transit corridor'
        : 'Priority field inspection queued for defect locations',
  };
}

// ==========================================
// POST /api/detect/video
// ==========================================

router.post('/api/detect/video', (req: Request, res: Response, next: NextFunction) => {
  const parsed = parseVideoOptions(req);
  if (!parsed.options) {
    return res.status(400).json({ error: parsed.error });
  }

  res.locals.videoOptions = parsed.options;
  next();
}, videoUpload.single('video'), async (req: Request, res: Response) => {
  const filesToCleanup: string[] = [];
  let keepVideo = false;

  try {
    const options = res.locals.videoOptions as VideoDetectionOptions;

    const apiKey = sanitizeApiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: 'Roboflow API key is not configured. Set ROBOFLOW_API_KEY in .env.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided. Upload a video as "video" field.' });
    }

    const videoPath = req.file.path;
    // The video is retained on success so submitted reports can play it back.
    // Only the temporary frame directory is always removed.
    filesToCleanup.push(videoPath);
    const relativeVideoPath = `uploads/videos/${req.file.filename}`;
    const videoPublicUrl = toPublicUploadUrl(relativeVideoPath);

    console.log(
      `[RoadGuard Video] Processing: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)} MB) ` +
      `confidence=${options.confidence}% overlap=${options.overlap}% model=${roboflowConfig.modelId}`,
    );

    // 1. Get video metadata
    let videoMeta: VideoMeta;
    try {
      videoMeta = await getVideoMetadata(videoPath);
    } catch (metaErr: any) {
      return res.status(400).json({
        error: 'Could not read video metadata. The file may be corrupted or in an unsupported format.',
        details: metaErr.message,
      });
    }

    console.log(
      `[RoadGuard Video] Duration: ${videoMeta.duration.toFixed(1)}s, ` +
      `${videoMeta.width}x${videoMeta.height}, ${videoMeta.fps}fps, codec: ${videoMeta.codec}`,
    );

    // 2. Calculate extraction parameters
    const sampling = planFrameExtraction(videoMeta.duration, options.extractionFps, options.maxFrames);
    const { estimatedFrames, framesToExtract: maxFrames, truncated } = sampling;

    console.log(
      `[RoadGuard Video] Extracting up to ${maxFrames} frames at ${options.extractionFps} fps ` +
      `(estimated ${estimatedFrames} frames, limit ${sampling.frameLimit})`,
    );

    // 3. Extract frames
    const sessionId = `vid_${Date.now()}`;
    let extraction: FrameExtractionResult;
    try {
      extraction = await extractFrames(videoPath, sessionId, options.extractionFps, maxFrames);
    } catch (extractErr: any) {
      return res.status(500).json({
        error: 'Frame extraction failed.',
        details: extractErr.message,
      });
    }
    filesToCleanup.push(extraction.sessionDir);

    const frameCount = extraction.framePaths.length;
    if (frameCount === 0) {
      return res.status(400).json({ error: 'No frames could be extracted from the video.' });
    }

    console.log(`[RoadGuard Video] Extracted ${frameCount} frames. Running detection...`);

    // 4. Run detection on each frame sequentially to respect Roboflow limits
    const frameResults: FrameDetectionResult[] = [];
    const errors: { frameIndex: number; error: string }[] = [];
    const fallbackImage = {
      width: videoMeta.width || 640,
      height: videoMeta.height || 640,
    };

    for (let i = 0; i < extraction.framePaths.length; i++) {
      try {
        const result = await detectFrame(
          extraction.framePaths[i],
          i,
          options.extractionFps,
          apiKey,
          fallbackImage,
          options,
        );
        frameResults.push(result);
      } catch (frameErr: any) {
        console.warn(`[RoadGuard Video] Frame ${i} detection failed:`, frameErr.message);
        errors.push({ frameIndex: i, error: frameErr.message });
      }
    }

    console.log(`[RoadGuard Video] Detection complete: ${frameResults.length}/${frameCount} frames processed`);

    // Every frame failing is a service failure, not an "empty road".
    if (frameResults.length === 0) {
      return res.status(502).json({
        error: 'Video detection failed for every extracted frame.',
        details: 'No frame could be analysed by the model. Check Roboflow availability and API credentials.',
        errors,
      });
    }

    // 5. Track detections across frames. Each frame's predictions have already
    // been deduplicated, so the tracker sees at most one detection per pothole.
    const trackFrames: TrackFrame[] = frameResults.map((frame) => ({
      frameIndex: frame.frameIndex,
      timestamp: frame.timestamp,
      predictions: frame.predictions,
      image: frame.image,
    }));

    const tracking: TrackingResult = trackPotholes(trackFrames, {
      matchIouThreshold: options.matchIou,
      maxMissedFrames: options.maxMissedFrames,
      ...(options.minHits !== null ? { minHits: options.minHits } : {}),
      failedFrameCount: errors.length,
    });

    const uniquePotholeCount = tracking.uniquePotholeCount;

    // 6. Aggregate raw and unique totals separately. `totalDetections` remains
    // the raw frame-level total for backwards compatibility; the final count is
    // `uniquePotholeCount`.
    const rawDetectionCount = frameResults.reduce((sum, frame) => sum + frame.analytics.rawDetectionCount, 0);
    const rawPredictionCount = frameResults.reduce((sum, frame) => sum + frame.analytics.rawPredictionCount, 0);
    // Frame-level detections AFTER same-frame duplicate suppression. This is
    // still not the unique answer: the same pothole can appear in several
    // frames, which is what the tracker resolves.
    const frameDetectionCount = frameResults.reduce((sum, frame) => sum + frame.predictions.length, 0);
    const candidateDetectionCount = rawDetectionCount;
    const duplicatePredictionsRemoved = frameResults.reduce(
      (sum, frame) => sum + frame.analytics.duplicatePredictionsRemoved,
      0,
    );
    const framesWithDetections = frameResults.filter((frame) => frame.predictions.length > 0).length;
    // The API echoes the executed model per frame; report the model from the
    // first successful frame so configuration drift is visible.
    const model = frameResults[0]?.model ?? {
      id: roboflowConfig.modelId,
      taskType: roboflowConfig.taskType,
    };

    console.log(
      `[RoadGuard Video] Counting: ${rawPredictionCount} model prediction(s) → ` +
      `${rawDetectionCount} above threshold → ${frameDetectionCount} per-frame unique → ` +
      `${uniquePotholeCount} unique pothole(s) across ${frameCount} sampled frame(s) ` +
      `(${tracking.tentativePotholeCount} tentative track(s))`,
    );

    const averageDamage = frameResults.length > 0
      ? parseFloat(
          (frameResults.reduce((sum, frame) => sum + frame.analytics.damagePercentage, 0) / frameResults.length)
            .toFixed(2),
        )
      : 0;

    const maxConfidence = tracking.representativeDetections.length > 0
      ? Math.max(...tracking.representativeDetections.map((prediction) => prediction.confidence))
      : 0;

    // Corridor risk is based on the confirmed unique count, not inflated raw
    // frame totals. The worst individual frame risk is still reported.
    const overallRiskLevel = calculateRiskLevel(uniquePotholeCount, averageDamage);
    const worstFrameRiskLevel = frameResults.reduce<RiskLevel>(
      (worst, frame) => maxRisk(worst, frame.analytics.overallRiskLevel),
      'LOW',
    );

    // 7. Honest reliability reporting: short/sparse videos cannot support an
    // exact unique count, so surface the limitation instead of inventing one.
    const limitations = [...tracking.limitations];
    if (videoMeta.duration < 2) {
      limitations.push('The video is shorter than 2 seconds; there is very little motion between frames to track.');
    }
    if (frameCount < 3) {
      limitations.push(`Only ${frameCount} frame(s) were sampled; cross-frame identity cannot be verified reliably.`);
    }
    if (estimatedFrames > sampling.frameLimit) {
      limitations.push(
        `Only the first ${maxFrames} of an estimated ${estimatedFrames} frames were analysed ` +
        `(frame limit ${sampling.frameLimit}); potholes visible later in the video are not counted.`,
      );
    }
    const warnings: string[] = [];
    if (errors.length > 0) {
      warnings.push(`${errors.length} of ${frameCount} frame(s) failed detection and were skipped.`);
    }
    if (options.fpsCapped) {
      warnings.push(
        `Requested extraction fps was capped at ${MAX_EXTRACTION_FPS}. Increase MAX_EXTRACTION_FPS if fast footage needs denser sampling.`,
      );
    }

    // 8. Persist to database (non-blocking, same pattern as image detection)
    let persistenceWarning: string | undefined;
    let inspectionId: number | undefined;
    const detectionMetadata = buildVideoDetectionMetadata({
      video: {
        ...videoMeta,
        filename: req.file.originalname,
        url: videoPublicUrl || '',
        path: relativeVideoPath,
      },
      image: {
        width: videoMeta.width || fallbackImage.width,
        height: videoMeta.height || fallbackImage.height,
      },
      frames: frameResults,
      uniquePotholeCount,
      rawDetectionCount,
      maxConfidence,
      averageDamage,
      overallRiskLevel,
    });

    try {
      const pool = getPool();
      if (pool) {
        inspectionId = await saveInspection({
          image_filename: req.file.originalname,
          image_path: null,
          media_type: 'video',
          video_path: relativeVideoPath,
          detection_metadata: detectionMetadata,
          image_width: videoMeta.width || fallbackImage.width,
          image_height: videoMeta.height || fallbackImage.height,
          // Keep raw frame total in detection_count and the final answer in
          // unique_pothole_count so history/analytics can show both.
          detection_count: rawDetectionCount,
          unique_pothole_count: uniquePotholeCount,
          overall_risk: overallRiskLevel,
          damage_percentage: averageDamage,
          confidence_threshold: options.confidence,
        });

        // Persist one representative detection per confirmed track rather than
        // every duplicate frame-level prediction.
        if (tracking.representativeDetections.length > 0) {
          const detectionRecords = tracking.representativeDetections.map((prediction) => ({
            inspection_id: inspectionId!,
            class_name: prediction.class || 'pothole',
            confidence: prediction.confidence || 0,
            severity: (prediction as any).severity || 'minor',
            x: prediction.x || 0,
            y: prediction.y || 0,
            width: prediction.width || 0,
            height: prediction.height || 0,
            polygon_points: prediction.points || null,
          }));
          await saveDetections(detectionRecords);
        }

        console.log(
          `[RoadGuard DB] Persisted video inspection #${inspectionId}: ${uniquePotholeCount} unique pothole(s), ` +
          `${rawDetectionCount} raw frame detection(s), ${tracking.totalTracks} track(s)`,
        );
      } else {
        persistenceWarning = 'Database pool not available — video detection not persisted';
        console.warn(`[RoadGuard DB] ${persistenceWarning}`);
      }
    } catch (dbError: any) {
      persistenceWarning = 'Database persistence failed — video detection results are still valid';
      console.error('[RoadGuard DB] Video persistence error (non-fatal):', dbError.message);
    }

    // 9. Build response
    const responsePayload: any = {
      success: true,
      type: 'video',
      video: {
        filename: req.file.originalname,
        duration: videoMeta.duration,
        width: videoMeta.width,
        height: videoMeta.height,
        fps: videoMeta.fps,
        codec: videoMeta.codec,
        url: videoPublicUrl,
        path: relativeVideoPath,
      },
      videoUrl: videoPublicUrl,
      videoPath: relativeVideoPath,
      processing: {
        extractionFps: options.extractionFps,
        totalFrames: frameCount,
        processedFrames: frameResults.length,
        failedFrames: errors.length,
        maxFrames,
        frameLimit: sampling.frameLimit,
        estimatedFrames,
        truncated,
      },
      model,
      analytics: {
        // Backwards-compatible raw frame total. The answer users need is
        // uniquePotholeCount (also mirrored in `totalDetected` below).
        totalDetections: rawDetectionCount,
        totalDetected: uniquePotholeCount,
        rawDetectionCount,
        rawPredictionCount,
        candidateDetectionCount,
        frameDetectionCount,
        duplicatePredictionsRemoved,
        uniquePotholeCount,
        confirmedPotholeCount: tracking.confirmedPotholeCount,
        tentativePotholeCount: tracking.tentativePotholeCount,
        totalTracks: tracking.totalTracks,
        framesWithDetections,
        maxConfidence: parseFloat(maxConfidence.toFixed(3)),
        avgDamagePercentage: averageDamage,
        overallRiskLevel,
        worstFrameRiskLevel,
      },
      quality: tracking.quality,
      limitations,
      tracking: {
        parameters: tracking.parameters,
        confirmedTracks: summarizeTracks(tracking.confirmedTracks),
        tentativeTracks: summarizeTracks(tracking.tentativeTracks),
      },
      uniqueDetections: tracking.representativeDetections,
      frames: frameResults,
      ...(warnings.length > 0 && { warnings }),
    };

    if (options.debug) {
      responsePayload.debug = {
        sampling,
        rawFrameDetections: frameResults.map((frame) => ({
          frameIndex: frame.frameIndex,
          timestamp: frame.timestamp,
          rawDetectionCount: frame.analytics.rawDetectionCount,
          rawPredictionCount: frame.analytics.rawPredictionCount,
          duplicatePredictionsRemoved: frame.analytics.duplicatePredictionsRemoved,
        })),
      };
    }

    if (errors.length > 0) {
      responsePayload.errors = errors;
    }

    if (inspectionId !== undefined) {
      responsePayload.persistence = {
        saved: true,
        inspectionId,
        videoUrl: videoPublicUrl,
        videoPath: relativeVideoPath,
      };
    } else if (persistenceWarning) {
      responsePayload.persistence = {
        saved: false,
        warning: persistenceWarning,
        videoUrl: videoPublicUrl,
        videoPath: relativeVideoPath,
      };
    }

    keepVideo = true;
    res.json(responsePayload);

  } catch (error: any) {
    console.error('[RoadGuard Video] Processing error:', error);
    res.status(500).json({
      error: 'Failed to process video detection',
      details: error instanceof Error ? error.message : 'Unknown server error',
    });
  } finally {
    // Remove extracted frames and failed-upload videos, but keep the original
    // video when detection succeeded so its durable URL remains playable.
    const retainedPath = keepVideo ? req.file?.path : undefined;
    cleanupFiles(filesToCleanup.filter((filePath) => filePath !== retainedPath));
  }
});

export default router;
