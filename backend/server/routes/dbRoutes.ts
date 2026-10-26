import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { checkDbHealth } from '../db/pool.js';
import {
  getInspections,
  getInspectionById,
  getDetectionsByInspectionId,
  getRoadIssues,
  getRoadIssueById,
  saveRoadIssue,
  updateRoadIssueStatus,
  getAnalyticsSummary,
} from '../db/persistence.js';
import {
  validateRoadIssue,
  validateStatusUpdate,
  validatePagination,
} from '../validation.js';
import { getProjectRoot } from '../utils/paths.js';
import { saveUploadBuffer, toPublicUploadUrl } from '../utils/uploads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = getProjectRoot(__dirname);
const uploadsRoot = join(projectRoot, 'uploads');

const issueUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

function parseOptionalMultipartBody(req: Request, _res: Response, next: NextFunction) {
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('multipart/form-data')) {
    return issueUpload.single('evidence')(req, _res, next);
  }
  next();
}

function withPublicMedia<T extends { evidence_path?: string | null; image_path?: string | null }>(record: T): T {
  const extra: Record<string, string | null> = {};
  if ('evidence_path' in record) {
    extra.evidence_url = toPublicUploadUrl(record.evidence_path ?? null);
  }
  if ('image_path' in record) {
    extra.image_url = toPublicUploadUrl(record.image_path ?? null);
  }
  return { ...record, ...extra };
}

/**
 * API routes for RoadGuard AI database features.
 * 
 * These are new endpoints added in Phase 3.
 * They do NOT modify or interfere with the existing
 * /api/health, /api/samples, /api/detect endpoints.
 */

const router = Router();

// ==========================================
// Database Health
// ==========================================

router.get('/api/db/health', async (_req: Request, res: Response) => {
  const result = await checkDbHealth();
  res.json({
    status: result.connected ? 'connected' : 'disconnected',
    database: 'MySQL',
    ...(result.error && { error: result.error }),
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// Inspections
// ==========================================

router.get('/api/inspections', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const result = await getInspections(limit, offset);
    res.json({
      ...result,
      inspections: result.inspections.map((row) => withPublicMedia(row)),
    });
  } catch (err: any) {
    console.error('[API] GET /api/inspections error:', err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

router.get('/api/inspections/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid inspection ID' });
    }

    const inspection = await getInspectionById(id);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    res.json(withPublicMedia(inspection));
  } catch (err: any) {
    console.error(`[API] GET /api/inspections/${req.params.id} error:`, err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

// ==========================================
// Detections (per inspection)
// ==========================================

router.get('/api/inspections/:id/detections', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid inspection ID' });
    }

    // Verify the inspection exists
    const inspection = await getInspectionById(id);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const detections = await getDetectionsByInspectionId(id);
    res.json({ inspection_id: id, detections });
  } catch (err: any) {
    console.error(`[API] GET /api/inspections/${req.params.id}/detections error:`, err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

// ==========================================
// Road Issues
// ==========================================

router.get('/api/issues', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const status = req.query.status ? String(req.query.status) : undefined;
    const result = await getRoadIssues({ limit, offset, status });
    res.json({
      ...result,
      issues: result.issues.map((row) => withPublicMedia(row)),
    });
  } catch (err: any) {
    console.error('[API] GET /api/issues error:', err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

router.get('/api/issues/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid issue ID' });
    }

    const issue = await getRoadIssueById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Road issue not found' });
    }

    res.json(withPublicMedia(issue));
  } catch (err: any) {
    console.error(`[API] GET /api/issues/${req.params.id} error:`, err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

router.post('/api/issues', parseOptionalMultipartBody, async (req: Request, res: Response) => {
  const body = { ...req.body };

  if (req.file) {
    try {
      const saved = saveUploadBuffer(
        uploadsRoot,
        'evidence',
        req.file.buffer,
        req.file.originalname || 'complaint.jpg'
      );
      body.evidence_path = saved.relativePath;
    } catch (err: any) {
      console.error('[API] Failed to store issue evidence:', err.message);
      return res.status(500).json({ error: 'Failed to store uploaded evidence image' });
    }
  } else if (typeof body.evidence_path === 'string' && (body.evidence_path.startsWith('blob:') || body.evidence_path.startsWith('data:'))) {
    // Never persist session-only blob URLs — they break after refresh
    body.evidence_path = null;
  }

  const validation = validateRoadIssue(body);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
  }

  try {
    const id = await saveRoadIssue({
      category: validation.data!.category,
      description: validation.data!.description,
      latitude: validation.data!.latitude,
      longitude: validation.data!.longitude,
      severity: validation.data!.severity,
      status: validation.data!.status,
      evidence_path: validation.data!.evidence_path,
    });

    const issue = await getRoadIssueById(id);
    res.status(201).json(issue ? withPublicMedia(issue) : issue);
  } catch (err: any) {
    console.error('[API] POST /api/issues error:', err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

router.patch('/api/issues/:id/status', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid issue ID' });
  }

  const validation = validateStatusUpdate(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
  }

  try {
    const updated = await updateRoadIssueStatus(id, validation.status!);
    if (!updated) {
      return res.status(404).json({ error: 'Road issue not found' });
    }

    const issue = await getRoadIssueById(id);
    res.json(issue ? withPublicMedia(issue) : issue);
  } catch (err: any) {
    console.error(`[API] PATCH /api/issues/${id}/status error:`, err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

// ==========================================
// Historical Analytics Summary
// ==========================================

router.get('/api/analytics/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getAnalyticsSummary();
    res.json(summary);
  } catch (err: any) {
    console.error('[API] GET /api/analytics/summary error:', err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

export default router;
