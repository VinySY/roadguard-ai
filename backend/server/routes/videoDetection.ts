import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { getPool } from '../db/pool.js';
import { saveInspection, saveDetections } from '../db/persistence.js';
import { deduplicateDetectionsAcrossFrames, calculateIoU } from '../utils/iou.js';
import { getProjectRoot } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = getProjectRoot(__dirname);

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

const ROBOFLOW_PROJECT = process.env.ROBOFLOW_PROJECT || 'pothole-detection-itsgr';
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION || '1';

function getSanitizedApiKey(): string {
  const rawKey = process.env.ROBOFLOW_API_KEY || '';
  return rawKey.replace(/^['"]|['"]$/g, '').replace(/^Bearer\s+/i, '').trim();
}

/** Maximum video file size (50 MB) */
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

/** Max frames to extract (caps processing time) */
const MAX_FRAMES = 30;

/** Default frames per second to extract */
const DEFAULT_FPS = 1;

/** Default Roboflow confidence threshold percentage */
const DEFAULT_CONFIDENCE = 20;

function parseConfidenceThreshold(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }

  const confidence = Number(value);
  if (!Number.isSafeInteger(confidence) || confidence < 0 || confidence > 100) {
    return null;
  }

  return confidence;
}

// Video upload via Multer — disk storage for FFmpeg access
const videoUploadsDir = join(projectRoot, 'uploads/videos');
if (!fs.existsSync(videoUploadsDir)) {
  fs.mkdirSync(videoUploadsDir, { recursive: true });
}

const framesDir = join(projectRoot, 'uploads/frames');
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

interface FrameDetectionResult {
  frameIndex: number;
  timestamp: number;  // seconds into the video
  predictions: any[];
  analytics: {
    totalDetected: number;
    maxConfidence: number;
    damagePercentage: number;
    overallRiskLevel: string;
  };
}

async function detectFrame(
  framePath: string,
  frameIndex: number,
  fps: number,
  apiKey: string,
  confidence: number,
  overlap: number
): Promise<FrameDetectionResult> {
  const imageBuffer = fs.readFileSync(framePath);
  const base64Image = imageBuffer.toString('base64');

  const roboflowUrl = `https://outline.roboflow.com/${encodeURIComponent(ROBOFLOW_PROJECT)}/${encodeURIComponent(ROBOFLOW_VERSION)}?api_key=${encodeURIComponent(apiKey)}&confidence=${confidence}&overlap=${overlap}`;

  const rfResponse = await fetch(roboflowUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: base64Image,
  });

  if (!rfResponse.ok) {
    const errorText = await rfResponse.text();
    throw new Error(`Roboflow API error (${rfResponse.status}): ${errorText}`);
  }

  const result = await rfResponse.json();
  const confidenceThreshold = confidence / 100;
  const predictions = (result.predictions || []).filter(
    (prediction: any) => prediction.confidence >= confidenceThreshold
  );
  const imageMeta = result.image || { width: 640, height: 640 };
  const totalImageArea = (imageMeta.width || 640) * (imageMeta.height || 640);

  let totalPotholeArea = 0;
  let maxConfidenceVal = 0;

  const enrichedPredictions = predictions.map((pred: any, idx: number) => {
    const area = (pred.width || 0) * (pred.height || 0);
    totalPotholeArea += area;
    if (pred.confidence > maxConfidenceVal) maxConfidenceVal = pred.confidence;

    const areaRatio = (area / totalImageArea) * 100;
    let severity: string = 'minor';
    if (areaRatio > 12 || pred.confidence > 0.85) severity = 'critical';
    else if (areaRatio > 6 || pred.confidence > 0.70) severity = 'high';
    else if (areaRatio > 2 || pred.confidence > 0.50) severity = 'moderate';

    return { ...pred, id: `pothole-${idx + 1}`, area, areaRatio: parseFloat(areaRatio.toFixed(2)), severity };
  });

  const damagePercentage = parseFloat(((totalPotholeArea / totalImageArea) * 100).toFixed(2));
  let overallRiskLevel = 'LOW';
  if (enrichedPredictions.length >= 4 || damagePercentage > 15) overallRiskLevel = 'CRITICAL';
  else if (enrichedPredictions.length >= 2 || damagePercentage > 7) overallRiskLevel = 'HIGH';
  else if (enrichedPredictions.length === 1 || damagePercentage > 2) overallRiskLevel = 'MEDIUM';

  return {
    frameIndex,
    timestamp: parseFloat((frameIndex / fps).toFixed(2)),
    predictions: enrichedPredictions,
    analytics: {
      totalDetected: enrichedPredictions.length,
      maxConfidence: parseFloat(maxConfidenceVal.toFixed(3)),
      damagePercentage,
      overallRiskLevel,
    },
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

// ==========================================
// POST /api/detect/video
// ==========================================

router.post('/api/detect/video', (req: Request, res: Response, next: NextFunction) => {
  const confidence = req.query.confidence === undefined
    ? DEFAULT_CONFIDENCE
    : parseConfidenceThreshold(req.query.confidence);

  if (confidence === null) {
    return res.status(400).json({
      error: 'Invalid confidence value. Provide an integer between 0 and 100.',
    });
  }

  res.locals.videoConfidenceThreshold = confidence;
  next();
}, videoUpload.single('video'), async (req: Request, res: Response) => {
  const filesToCleanup: string[] = [];

  try {
    const confidence = res.locals.videoConfidenceThreshold as number;

    const apiKey = getSanitizedApiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: 'Roboflow API key is not configured. Set ROBOFLOW_API_KEY in .env.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided. Upload a video as "video" field.' });
    }

    const videoPath = req.file.path;
    filesToCleanup.push(videoPath);

    console.log(`[RoadGuard Video] Processing: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);

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

    console.log(`[RoadGuard Video] Duration: ${videoMeta.duration.toFixed(1)}s, ${videoMeta.width}x${videoMeta.height}, ${videoMeta.fps}fps, codec: ${videoMeta.codec}`);

    // 2. Calculate extraction parameters
    const requestedFps = req.query.fps ? parseFloat(req.query.fps as string) : DEFAULT_FPS;
    const extractionFps = Math.max(0.1, Math.min(requestedFps, 5)); // Cap between 0.1 and 5 fps
    const estimatedFrames = Math.ceil(videoMeta.duration * extractionFps);
    const maxFrames = Math.min(estimatedFrames, MAX_FRAMES);

    const overlap = req.query.overlap ? parseInt(req.query.overlap as string, 10) : 30;

    console.log(`[RoadGuard Video] Extracting up to ${maxFrames} frames at ${extractionFps} fps`);

    // 3. Extract frames
    const sessionId = `vid_${Date.now()}`;
    let extraction: FrameExtractionResult;
    try {
      extraction = await extractFrames(videoPath, sessionId, extractionFps, maxFrames);
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

    // 4. Run detection on each frame (sequentially to respect Roboflow rate limits)
    const frameResults: FrameDetectionResult[] = [];
    const errors: { frameIndex: number; error: string }[] = [];

    for (let i = 0; i < extraction.framePaths.length; i++) {
      try {
        const result = await detectFrame(
          extraction.framePaths[i],
          i,
          extractionFps,
          apiKey,
          confidence,
          overlap
        );
        frameResults.push(result);
      } catch (frameErr: any) {
        console.warn(`[RoadGuard Video] Frame ${i} detection failed:`, frameErr.message);
        errors.push({ frameIndex: i, error: frameErr.message });
      }
    }

    console.log(`[RoadGuard Video] Detection complete: ${frameResults.length}/${frameCount} frames processed`);

    // 5. Aggregate results across all frames
    const allPredictions = frameResults.flatMap(f => f.predictions);
    const framesWithDetections = frameResults.filter(f => f.predictions.length > 0);
    const totalDetections = allPredictions.length;

    // 6. Deduplicate detections across frames using IoU
    // This prevents counting the same pothole appearing in multiple frames as separate potholes
    const iouThreshold = req.query.iou ? parseFloat(req.query.iou as string) : 0.70;
    const deduplicationResult = deduplicateDetectionsAcrossFrames(frameResults, iouThreshold);
    const uniquePotholeCount = deduplicationResult.uniquePotholeCount;

    console.log(`[RoadGuard Video] Deduplication: ${totalDetections} raw detections → ${uniquePotholeCount} unique potholes (IoU threshold: ${iouThreshold})`);

    // Calculate overall risk from frame-level analytics
    let worstRisk = 'LOW';
    const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    for (const fr of frameResults) {
      if (riskOrder.indexOf(fr.analytics.overallRiskLevel) > riskOrder.indexOf(worstRisk)) {
        worstRisk = fr.analytics.overallRiskLevel;
      }
    }

    const avgDamage = frameResults.length > 0
      ? parseFloat((frameResults.reduce((sum, f) => sum + f.analytics.damagePercentage, 0) / frameResults.length).toFixed(2))
      : 0;

    const maxConfAll = frameResults.length > 0
      ? Math.max(...frameResults.map(f => f.analytics.maxConfidence))
      : 0;

    // 7. Persist to database (non-blocking, same pattern as image detection)
    let persistenceWarning: string | undefined;
    let inspectionId: number | undefined;

    try {
      const pool = getPool();
      if (pool) {
        // Create a single inspection record for the video
        inspectionId = await saveInspection({
          image_filename: req.file.originalname,
          image_path: null,  // No persisted video (too large)
          image_width: videoMeta.width,
          image_height: videoMeta.height,
          detection_count: totalDetections,
          unique_pothole_count: uniquePotholeCount,  // Store the deduplicated count
          overall_risk: worstRisk,
          damage_percentage: avgDamage,
          confidence_threshold: confidence,
        });

        // Save all detections from all frames
        if (allPredictions.length > 0) {
          const detectionRecords = allPredictions.map((pred: any) => ({
            inspection_id: inspectionId!,
            class_name: pred.class || 'pothole',
            confidence: pred.confidence || 0,
            severity: pred.severity || 'minor',
            x: pred.x || 0,
            y: pred.y || 0,
            width: pred.width || 0,
            height: pred.height || 0,
            polygon_points: pred.points || null,
          }));
          await saveDetections(detectionRecords);
        }

        console.log(`[RoadGuard DB] Persisted video inspection #${inspectionId} with ${totalDetections} detections from ${frameCount} frames`);
      } else {
        persistenceWarning = 'Database pool not available — video detection not persisted';
        console.warn(`[RoadGuard DB] ${persistenceWarning}`);
      }
    } catch (dbError: any) {
      persistenceWarning = 'Database persistence failed — video detection results are still valid';
      console.error('[RoadGuard DB] Video persistence error (non-fatal):', dbError.message);
    }

    // 7. Build response
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
      },
      processing: {
        extractionFps,
        totalFrames: frameCount,
        processedFrames: frameResults.length,
        failedFrames: errors.length,
      },
      analytics: {
        totalDetections,
        uniquePotholeCount,
        framesWithDetections: framesWithDetections.length,
        maxConfidence: parseFloat(maxConfAll.toFixed(3)),
        avgDamagePercentage: avgDamage,
        overallRiskLevel: worstRisk,
      },
      frames: frameResults,
    };

    if (errors.length > 0) {
      responsePayload.errors = errors;
    }

    if (inspectionId !== undefined) {
      responsePayload.persistence = { saved: true, inspectionId };
    } else if (persistenceWarning) {
      responsePayload.persistence = { saved: false, warning: persistenceWarning };
    }

    res.json(responsePayload);

  } catch (error: any) {
    console.error('[RoadGuard Video] Processing error:', error);
    res.status(500).json({
      error: 'Failed to process video detection',
      details: error instanceof Error ? error.message : 'Unknown server error',
    });
  } finally {
    // Always clean up temporary files
    cleanupFiles(filesToCleanup);
  }
});

export default router;
