import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import exifr from 'exifr';
import { getPool, checkDbHealth, closePool } from './db/pool.js';
import { saveInspection, saveDetections } from './db/persistence.js';
import dbRoutes from './routes/dbRoutes.js';
import videoRoutes from './routes/videoDetection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Roboflow Model Configuration (YOLOv11 Instance Segmentation)
const ROBOFLOW_WORKSPACE = process.env.ROBOFLOW_WORKSPACE || 'govindsy43564-gmail-com';
const ROBOFLOW_PROJECT = process.env.ROBOFLOW_PROJECT || 'pothole-detection-itsgr';
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION || '1';

/**
 * Sanitizes and normalizes API keys from environment variables.
 * Handles raw keys, wrapped quotes, or 'Bearer ' prefixes gracefully.
 */
function getSanitizedApiKey(): string {
  const rawKey = process.env.ROBOFLOW_API_KEY || '';
  return rawKey.replace(/^['"]|['"]$/g, '').replace(/^Bearer\s+/i, '').trim();
}

// Ensure uploads directory exists for persisting inspection images
const uploadsDir = join(__dirname, '../uploads/inspections');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// Mount Phase 3 database routes (inspections, issues, db health)
app.use(dbRoutes);

// Mount video detection routes
app.use(videoRoutes);

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const apiKey = getSanitizedApiKey();
  const isConfigured = apiKey.length > 0;

  let modelReachable = false;
  let modelInfo: any = null;

  if (isConfigured) {
    try {
      const probeUrl = `https://api.roboflow.com/${encodeURIComponent(ROBOFLOW_WORKSPACE)}/${encodeURIComponent(ROBOFLOW_PROJECT)}/${encodeURIComponent(ROBOFLOW_VERSION)}?api_key=${encodeURIComponent(apiKey)}`;
      const probeRes = await fetch(probeUrl, { signal: AbortSignal.timeout(5000) });
      if (probeRes.ok) {
        modelReachable = true;
        const data = await probeRes.json();
        modelInfo = {
          projectName: data?.project?.name || ROBOFLOW_PROJECT,
          projectType: data?.project?.type || 'instance-segmentation',
          version: ROBOFLOW_VERSION,
          updated: data?.project?.updated
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
      workspace: ROBOFLOW_WORKSPACE,
      project: ROBOFLOW_PROJECT,
      version: ROBOFLOW_VERSION,
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
    const testDir = join(__dirname, '../test/images');
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
  const filePath = join(__dirname, '../test/images', safeFilename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Sample image not found' });
  }
});

// Main Pothole Detection Endpoint
app.post('/api/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const apiKey = getSanitizedApiKey();

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
      const samplePath = join(__dirname, '../test/images', safeFilename);
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

    // Parse confidence and overlap options
    const confidence = req.query.confidence ? parseInt(req.query.confidence as string, 10) : 20;
    const overlap = req.query.overlap ? parseInt(req.query.overlap as string, 10) : 30;

    const base64Image = imageBuffer.toString('base64');

    // Call Roboflow Instance Segmentation API (outline endpoint)
    const roboflowUrl = `https://outline.roboflow.com/${encodeURIComponent(ROBOFLOW_PROJECT)}/${encodeURIComponent(ROBOFLOW_VERSION)}?api_key=${encodeURIComponent(apiKey)}&confidence=${confidence}&overlap=${overlap}`;

    const rfResponse = await fetch(roboflowUrl, {
      method: 'POST',
      headers: {
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

    const result = await rfResponse.json();

    // Enrich response with server-calculated analytics
    const predictions = result.predictions || [];
    const imageMeta = result.image || { width: 640, height: 640 };
    const totalImageArea = (imageMeta.width || 640) * (imageMeta.height || 640);

    let totalPotholeArea = 0;
    let maxConfidence = 0;

    const enrichedPredictions = predictions.map((pred: any, index: number) => {
      const area = (pred.width || 0) * (pred.height || 0);
      totalPotholeArea += area;
      if (pred.confidence > maxConfidence) {
        maxConfidence = pred.confidence;
      }

      // Determine individual pothole severity
      const areaRatio = (area / totalImageArea) * 100;
      let severity: 'minor' | 'moderate' | 'high' | 'critical' = 'minor';
      if (areaRatio > 12 || pred.confidence > 0.85) severity = 'critical';
      else if (areaRatio > 6 || pred.confidence > 0.70) severity = 'high';
      else if (areaRatio > 2 || pred.confidence > 0.50) severity = 'moderate';

      return {
        ...pred,
        id: `pothole-${index + 1}`,
        area,
        areaRatio: parseFloat(areaRatio.toFixed(2)),
        severity
      };
    });

    const damagePercentage = parseFloat(((totalPotholeArea / totalImageArea) * 100).toFixed(2));
    let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (enrichedPredictions.length >= 4 || damagePercentage > 15) overallRiskLevel = 'CRITICAL';
    else if (enrichedPredictions.length >= 2 || damagePercentage > 7) overallRiskLevel = 'HIGH';
    else if (enrichedPredictions.length === 1 || damagePercentage > 2) overallRiskLevel = 'MEDIUM';

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

    try {
      const pool = getPool();
      if (pool) {
        // Save uploaded image to disk (only for user uploads, not samples)
        let imagePath: string | null = null;
        if (req.file) {
          const timestamp = Date.now();
          const safeOriginal = imageFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
          const diskFilename = `${timestamp}_${safeOriginal}`;
          const diskPath = join(uploadsDir, diskFilename);
          fs.writeFileSync(diskPath, imageBuffer!);
          imagePath = `uploads/inspections/${diskFilename}`;
        }

        // Create inspection record
        inspectionId = await saveInspection({
          image_filename: imageFilename,
          image_path: imagePath,
          image_width: imageMeta.width || 640,
          image_height: imageMeta.height || 640,
          detection_count: enrichedPredictions.length,
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

        console.log(`[RoadGuard DB] Persisted inspection #${inspectionId} with ${enrichedPredictions.length} detections`);
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
      time: result.time || 0,
      image: imageMeta,
      predictions: enrichedPredictions,
      analytics: {
        totalDetected: enrichedPredictions.length,
        maxConfidence: parseFloat(maxConfidence.toFixed(3)),
        damagePercentage,
        overallRiskLevel
      },
      ...(location && { location })
    };

    // Add non-breaking persistence metadata (new fields the frontend can ignore)
    if (inspectionId !== undefined) {
      responsePayload.persistence = {
        saved: true,
        inspectionId,
      };
    } else if (persistenceWarning) {
      responsePayload.persistence = {
        saved: false,
        warning: persistenceWarning,
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

const server = app.listen(PORT, () => {
  console.log(`[RoadGuard AI] Backend server active on http://localhost:${PORT}`);
  console.log(`[RoadGuard AI] Roboflow Project: ${ROBOFLOW_PROJECT} (v${ROBOFLOW_VERSION})`);
  console.log(`[RoadGuard AI] API Key status: ${getSanitizedApiKey() ? 'Configured' : 'Missing'}`);
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
