import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import exifr from 'exifr';
import { getPool, checkDbHealth, closePool } from './db/pool.js';
import { saveInspection, saveDetections } from './db/persistence.js';
import dbRoutes from './routes/dbRoutes.js';
import videoRoutes from './routes/videoDetection.js';
import { getProjectRoot } from './utils/paths.js';
import { ensureDir, saveUploadBuffer, toPublicUploadUrl } from './utils/uploads.js';
import {
  buildModelsMetadataUrl,
  buildServerlessInferenceUrl,
  getRoboflowConfig,
  sanitizeApiKey,
} from './config/roboflow.js';
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
  parsePercentParam,
  parseUnitIntervalParam,
  validateRoboflowResponse,
} from './utils/detectionPostprocess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = getProjectRoot(__dirname);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Configurable CORS origins for production (Vercel) & local development
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server, health probes)
      if (!origin) return callback(null, true);

      // Explicitly configured frontend URLs or wildcard
      if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Automatically allow Vercel production and preview domains
      if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      // Allow local development and private LAN connections
      if (/^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Roboflow Model Configuration (RF-DETR instance segmentation).
// `ROBOFLOW_MODEL_ID` is authoritative for inference; see config/roboflow.ts.
const roboflowConfig = getRoboflowConfig();

// Ensure uploads directory exists for persisting inspection and complaint images
const uploadsRoot = join(projectRoot, 'uploads');
const uploadsDir = join(uploadsRoot, 'inspections');
ensureDir(uploadsDir);
ensureDir(join(uploadsRoot, 'evidence'));

// In-memory Multer storage for high-throughput, leak-free buffer processing
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

app.use(express.json({ limit: '10mb' }));

// Serve persisted inspection and complaint files at /api/uploads/...
app.use(
  '/api/uploads',
  express.static(uploadsRoot, {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// Mount Phase 3 database routes (inspections, issues, db health)
app.use(dbRoutes);

// Persist a complaint/report photograph independently of detection
app.post('/api/evidence', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided. Attach a JPEG, PNG, or WebP file as "image".' });
  }

  try {
    const saved = saveUploadBuffer(
      uploadsRoot,
      'evidence',
      req.file.buffer,
      req.file.originalname || 'complaint.jpg'
    );
    return res.status(201).json({
      success: true,
      url: saved.publicUrl,
      path: saved.relativePath,
      filename: saved.filename,
    });
  } catch (error: any) {
    console.error('[RoadGuard] Evidence upload failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to store uploaded evidence image' });
  }
});

// Mount video detection routes
app.use(videoRoutes);

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const apiKey = sanitizeApiKey();
  const isConfigured = apiKey.length > 0;

  let modelReachable = false;
  let modelInfo: any = null;

  if (isConfigured) {
    try {
      // Probe the deployed model list (bearer auth, key never in the URL).
      const probeRes = await fetch(buildModelsMetadataUrl(roboflowConfig), {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (probeRes.ok) {
        const models = await probeRes.json();
        const match = Array.isArray(models)
          ? models.find((model: any) => model?.url === roboflowConfig.modelId)
          : null;
        modelReachable = Boolean(match);
        modelInfo = match
          ? {
              name: match.name,
              taskType: match.taskType,
              modelType: match.modelType,
              created: match.created,
              trainStatus: match.train?.status,
              metrics: match.metrics ?? null,
            }
          : {
              found: false,
              availableModels: Array.isArray(models)
                ? models.map((model: any) => model?.url).filter(Boolean)
                : [],
            };
      }
    } catch {
      // Model probe failed or timed out
    }
  }

  // Include database status in health check
  const dbHealth = await checkDbHealth();

  res.json({
    status: 'ok',
    apiKeyConfigured: isConfigured,
    modelReachable,
    model: {
      workspace: roboflowConfig.workspace,
      project: roboflowConfig.project,
      version: roboflowConfig.version,
      modelId: roboflowConfig.modelId,
      taskType: roboflowConfig.taskType,
      details: modelInfo
    },
    database: {
      connected: dbHealth.connected,
      ...(dbHealth.error && { error: dbHealth.error })
    },
    serverTime: new Date().toISOString()
  });
});

// Provide sample images from test/images directory for quick UI testing
app.get('/api/samples', (_req: Request, res: Response) => {
  try {
    const testDir = join(projectRoot, 'test/images');
    if (!fs.existsSync(testDir)) {
      return res.json({ samples: [] });
    }

    const files = fs.readdirSync(testDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    // Return a curated selection of sample names
    const sampleFiles = files.slice(0, 12).map((filename, index) => ({
      id: `sample-${index + 1}`,
      name: filename.replace(/_jpg\.rf\..*$/, '.jpg').replace(/_/g, ' '),
      filename
    }));

    res.json({ samples: sampleFiles });
  } catch (error) {
    console.error('Failed to list sample images:', error);
    res.json({ samples: [] });
  }
});

// Serve sample images static endpoint
app.get('/api/samples/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  // Security check to prevent path traversal
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(projectRoot, 'test/images', safeFilename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Sample image not found' });
  }
});

// Main Pothole Detection Endpoint
app.post('/api/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const apiKey = sanitizeApiKey();

    if (!apiKey) {
      return res.status(500).json({
        error: 'Roboflow API key is not configured. Please set ROBOFLOW_API_KEY in your .env file.'
      });
    }

    let imageBuffer: Buffer | null = null;
    let imageFilename = 'upload.jpg';

    if (req.file) {
      imageBuffer = req.file.buffer;
      imageFilename = req.file.originalname || 'upload.jpg';
    } else if (req.body && req.body.sampleFilename) {
      const safeFilename = req.body.sampleFilename.replace(/[^a-zA-Z0-9._-]/g, '');
      const samplePath = join(projectRoot, 'test/images', safeFilename);
      if (fs.existsSync(samplePath)) {
        imageBuffer = fs.readFileSync(samplePath);
        imageFilename = safeFilename;
      } else {
        return res.status(404).json({ error: 'Sample image not found' });
      }
    }

    if (!imageBuffer) {
      return res.status(400).json({ error: 'No image provided. Please upload an image or select a sample.' });
    }

    // Parse and validate confidence / overlap options. Invalid values return
    // 400 instead of being silently forwarded to Roboflow as NaN.
    const confidence = parsePercentParam(req.query.confidence, DEFAULT_CONFIDENCE_PERCENT);
    const overlap = parsePercentParam(req.query.overlap, DEFAULT_OVERLAP_PERCENT);
    if (confidence === null) {
      return res.status(400).json({
        error: 'Invalid confidence value. Provide a number between 0 and 100.',
      });
    }
    if (overlap === null) {
      return res.status(400).json({
        error: 'Invalid overlap value. Provide a number between 0 and 100.',
      });
    }

    const dedupeEnabled = parseBooleanParam(req.query.dedupe ?? req.query.deduplicate, true);
    const maskIouThreshold = parseUnitIntervalParam(
      req.query.maskIou ?? req.query.dedupeIou,
      DEFAULT_MASK_IOU_THRESHOLD,
    );
    const boxIouThreshold = parseUnitIntervalParam(
      req.query.boxIou ?? req.query.dedupeBoxIou,
      DEFAULT_BOX_IOU_THRESHOLD,
    );
    const containmentThreshold = parseUnitIntervalParam(
      req.query.containment,
      DEFAULT_CONTAINMENT_THRESHOLD,
    );
    const minAreaRatio = parseUnitIntervalParam(
      req.query.minAreaRatio,
      DEFAULT_MIN_AREA_RATIO_FOR_CONTAINMENT,
    );
    const debug = parseBooleanParam(req.query.debug, false);

    if (maskIouThreshold === null || boxIouThreshold === null || containmentThreshold === null || minAreaRatio === null) {
      return res.status(400).json({
        error: 'Invalid deduplication threshold. maskIou/boxIou/containment/minAreaRatio must be between 0 and 1.',
      });
    }

    const base64Image = imageBuffer.toString('base64');

    // Call the deployed RF-DETR segmentation model through Roboflow's
    // Serverless Cloud API. Percentages are converted to 0–1 fractions.
    const roboflowUrl = buildServerlessInferenceUrl(roboflowConfig.modelId, {
      confidencePercent: confidence,
      overlapPercent: overlap,
    });

    const rfResponse = await fetch(roboflowUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: base64Image
    });

    if (!rfResponse.ok) {
      const errorText = await rfResponse.text();
      console.error(`Roboflow API returned status ${rfResponse.status}:`, errorText);
      return res.status(rfResponse.status).json({
        error: `Roboflow API error (${rfResponse.status})`,
        details: errorText
      });
    }

    let result: unknown;
    try {
      result = await rfResponse.json();
    } catch {
      return res.status(502).json({
        error: 'Invalid response from Roboflow',
        details: 'The model returned a non-JSON response.',
      });
    }

    // Validate/normalise the model response before doing any counting.
    let validated;
    try {
      validated = validateRoboflowResponse(result);
    } catch (validationError: any) {
      if (validationError instanceof InvalidRoboflowResponseError) {
        return res.status(502).json({
          error: 'Invalid response from Roboflow',
          details: validationError.message,
        });
      }
      throw validationError;
    }

    const imageMeta = validated.image;

    // The API echoes the model it actually executed. Surface it in logs and in
    // the response so a misconfigured model ID is immediately visible.
    const resolvedModel = (result as any)?.resolved_model;
    const modelId = resolvedModel?.model_id || roboflowConfig.modelId;
    console.log(
      `[RoadGuard AI] Inference model: ${modelId} (${roboflowConfig.taskType}, ` +
      `${validated.rawPredictionCount} raw prediction(s))`,
    );

    // Confidence is applied locally as well as at Roboflow so a model/API
    // change cannot bypass the threshold.
    const candidates = filterByConfidence(validated.predictions, confidence / 100);
    const deduplication = dedupeEnabled
      ? deduplicatePredictions(candidates, {
          maskIouThreshold: maskIouThreshold,
          boxIouThreshold: boxIouThreshold,
          containmentThreshold: containmentThreshold,
          minAreaRatioForContainment: minAreaRatio,
        })
      : {
          predictions: candidates,
          candidateCount: candidates.length,
          duplicateCount: 0,
          suppressed: [],
        };

    const uniquePredictions = deduplication.predictions;
    const enrichedPredictions = enrichPredictions(uniquePredictions, imageMeta);
    const uniquePotholeCount = enrichedPredictions.length;
    // "Raw" means predictions that survived confidence filtering, before
    // duplicate suppression. Kept separate from the unique count so callers
    // can still audit/debug model output.
    const rawDetectionCount = candidates.length;
    const duplicatePredictionsRemoved = deduplication.duplicateCount;
    const damagePercentage = calculateDamagePercentage(uniquePredictions, imageMeta);
    const maxConfidence = maxConfidenceOf(uniquePredictions);
    const overallRiskLevel = calculateRiskLevel(uniquePotholeCount, damagePercentage);

    const warnings = [...validated.warnings];
    if (duplicatePredictionsRemoved > 0) {
      warnings.push(
        `${duplicatePredictionsRemoved} duplicate/overlapping prediction(s) were merged into ${uniquePotholeCount} unique pothole(s).`,
      );
    }

    // ===================================================================
    // EXIF GPS Extraction: Safely parse GPS telemetry if embedded in image
    // ===================================================================
    let location: { latitude: number; longitude: number } | null = null;
    try {
      if (imageBuffer) {
        const gps = await exifr.gps(imageBuffer);
        if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
          if (!isNaN(gps.latitude) && !isNaN(gps.longitude)) {
            location = {
              latitude: parseFloat(gps.latitude.toFixed(7)),
              longitude: parseFloat(gps.longitude.toFixed(7)),
            };
            console.log(`[RoadGuard EXIF] Extracted GPS coordinates: ${location.latitude}, ${location.longitude}`);
          }
        }
      }
    } catch {
      // Non-fatal: image has no EXIF or unsupported format
      location = null;
    }

    // ===================================================================
    // Phase 3: Persist detection results to MySQL (non-blocking)
    // 
    // CRITICAL: Database persistence MUST NOT break the detection response.
    // If MySQL fails, the frontend still receives successful Roboflow data.
    // ===================================================================
    let persistenceWarning: string | undefined;
    let inspectionId: number | undefined;
    let imagePath: string | null = null;
    let persistedImageUrl: string | null = null;

    // Always persist user-uploaded photographs to disk so they remain
    // accessible after refresh, even if MySQL is unavailable.
    if (req.file && imageBuffer) {
      try {
        const saved = saveUploadBuffer(
          uploadsRoot,
          'inspections',
          imageBuffer,
          imageFilename
        );
        imagePath = saved.relativePath;
        persistedImageUrl = saved.publicUrl;
      } catch (fileError: any) {
        console.error('[RoadGuard] Failed to persist inspection image:', fileError?.message || fileError);
      }
    }

    try {
      const pool = getPool();
      if (pool) {
        // Create inspection record
        inspectionId = await saveInspection({
          image_filename: imageFilename,
          image_path: imagePath,
          image_width: imageMeta.width || 640,
          image_height: imageMeta.height || 640,
          detection_count: rawDetectionCount,
          unique_pothole_count: uniquePotholeCount,
          overall_risk: overallRiskLevel,
          damage_percentage: damagePercentage,
          confidence_threshold: confidence,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
        });

        // Create detection records
        if (enrichedPredictions.length > 0) {
          const detectionRecords = enrichedPredictions.map((pred: any) => ({
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

        console.log(
          `[RoadGuard DB] Persisted inspection #${inspectionId}: ${uniquePotholeCount} unique pothole(s) ` +
          `(${rawDetectionCount} raw prediction(s), ${duplicatePredictionsRemoved} duplicate(s) merged)`,
        );
      } else {
        persistenceWarning = 'Database pool not available — detection not persisted';
        console.warn(`[RoadGuard DB] ${persistenceWarning}`);
      }
    } catch (dbError: any) {
      // Database failure must NOT prevent the detection response
      persistenceWarning = 'Database persistence failed — detection results are still valid';
      console.error('[RoadGuard DB] Persistence error (non-fatal):', dbError.message);
    }

    // Build the response — SAME structure the frontend expects
    const responsePayload: any = {
      success: true,
      time: (result as any)?.time || 0,
      image: imageMeta,
      model: {
        id: modelId,
        taskType: roboflowConfig.taskType,
        ...(resolvedModel?.model_package_id && { packageId: resolvedModel.model_package_id }),
        ...(resolvedModel?.backend && { backend: resolvedModel.backend }),
        ...(resolvedModel?.quantization && { quantization: resolvedModel.quantization }),
      },
      predictions: enrichedPredictions,
      analytics: {
        // `totalDetected` is the final, user-facing unique count to preserve
        // backwards compatibility. Raw totals live in explicit fields below.
        totalDetected: uniquePotholeCount,
        uniquePotholeCount,
        rawDetectionCount,
        rawTotalDetected: rawDetectionCount,
        rawPredictionCount: validated.rawPredictionCount,
        candidateDetectionCount: deduplication.candidateCount,
        duplicatePredictionsRemoved,
        maxConfidence: parseFloat(maxConfidence.toFixed(3)),
        damagePercentage,
        overallRiskLevel
      },
      confidenceThreshold: confidence,
      deduplication: {
        enabled: dedupeEnabled,
        maskIouThreshold,
        boxIouThreshold,
        containmentThreshold,
        minAreaRatioForContainment: minAreaRatio,
        duplicatesRemoved: duplicatePredictionsRemoved,
      },
      ...(warnings.length > 0 && { warnings }),
      ...(location && { location })
    };

    // Optional debug payload: full pre-dedupe predictions and the suppression
    // decisions. Never returned by default because it increases response size
    // and exposes model internals.
    if (debug) {
      responsePayload.debug = {
        rawPredictions: candidates,
        suppressed: deduplication.suppressed.map((entry) => ({
          keptDetectionId: (entry.kept as any).detection_id ?? null,
          keptClass: entry.kept.class,
          keptConfidence: entry.kept.confidence,
          removedDetectionId: (entry.removed as any).detection_id ?? null,
          removedClass: entry.removed.class,
          removedConfidence: entry.removed.confidence,
          maskIoU: entry.maskIoU,
          maskIoS: entry.maskIoS,
          boxIoU: entry.boxIoU,
        })),
      };
    }

    if (persistedImageUrl) {
      responsePayload.imageUrl = persistedImageUrl;
      responsePayload.image_path = imagePath;
    }

    // Add non-breaking persistence metadata (new fields the frontend can ignore)
    if (inspectionId !== undefined) {
      responsePayload.persistence = {
        saved: true,
        inspectionId,
        imageUrl: persistedImageUrl,
        imagePath,
      };
    } else if (persistenceWarning) {
      responsePayload.persistence = {
        saved: false,
        warning: persistenceWarning,
        imageUrl: persistedImageUrl,
        imagePath,
      };
    } else if (persistedImageUrl) {
      responsePayload.persistence = {
        saved: false,
        imageUrl: persistedImageUrl,
        imagePath,
      };
    }

    res.json(responsePayload);

  } catch (error: any) {
    console.error('Pothole detection processing error:', error);
    res.status(500).json({
      error: 'Failed to process image detection',
      details: error instanceof Error ? error.message : 'Unknown server error'
    });
  }
});

// Initialize database pool (non-blocking — server starts regardless)
const pool = getPool();
if (pool) {
  checkDbHealth().then(health => {
    if (health.connected) {
      console.log('[RoadGuard AI] ✓ MySQL database connected');
    } else {
      console.warn('[RoadGuard AI] ⚠ MySQL database not reachable:', health.error);
      console.warn('[RoadGuard AI]   Detection will still work — persistence disabled until DB is available');
    }
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[RoadGuard AI] Backend server active on http://${HOST}:${PORT}`);
  console.log(`[RoadGuard AI] Roboflow model: ${roboflowConfig.modelId} (${roboflowConfig.taskType})`);
  console.log(`[RoadGuard AI] API Key status: ${roboflowConfig.apiKeyConfigured ? 'Configured' : 'Missing'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[RoadGuard AI] Shutting down...');
  await closePool();
  server.close();
});

process.on('SIGINT', async () => {
  console.log('[RoadGuard AI] Shutting down...');
  await closePool();
  server.close();
});
