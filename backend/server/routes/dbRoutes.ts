import { Router, Request, Response } from 'express';
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
    res.json(result);
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

    res.json(inspection);
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
    res.json(result);
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

    res.json(issue);
  } catch (err: any) {
    console.error(`[API] GET /api/issues/${req.params.id} error:`, err.message);
    res.status(503).json({ error: 'Database unavailable', details: err.message });
  }
});

router.post('/api/issues', async (req: Request, res: Response) => {
  const validation = validateRoadIssue(req.body);
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
    res.status(201).json(issue);
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
    res.json(issue);
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
