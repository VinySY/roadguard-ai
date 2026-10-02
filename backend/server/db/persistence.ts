import { getPool } from './pool.js';
import type { ResultSetHeader } from 'mysql2';

/**
 * Persistence service for RoadGuard AI.
 * 
 * Provides functions to save and retrieve inspections, detections,
 * and road issues. All database operations use parameterized queries.
 */

// ==========================================
// Types
// ==========================================

export interface InspectionRecord {
  id: number;
  image_filename: string;
  image_path: string | null;
  image_width: number;
  image_height: number;
  detection_count: number;
  unique_pothole_count: number | null;
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  damage_percentage: number;
  confidence_threshold: number;
  latitude?: number | null;
  longitude?: number | null;
  created_at: Date;
}

export interface DetectionRecord {
  id: number;
  inspection_id: number;
  class_name: string;
  confidence: number;
  severity: 'minor' | 'moderate' | 'high' | 'critical';
  x: number;
  y: number;
  width: number;
  height: number;
  polygon_points: any[] | null;
  created_at: Date;
}

export interface RoadIssueRecord {
  id: number;
  category: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  severity: 'minor' | 'moderate' | 'high' | 'critical';
  status: 'Reported' | 'In Inspection' | 'Scheduled for Repair' | 'Resolved';
  evidence_path: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionInsertData {
  image_filename: string;
  image_path: string | null;
  image_width: number;
  image_height: number;
  detection_count: number;
  unique_pothole_count?: number | null;
  overall_risk: string;
  damage_percentage: number;
  confidence_threshold: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DetectionInsertData {
  inspection_id: number;
  class_name: string;
  confidence: number;
  severity: string;
  x: number;
  y: number;
  width: number;
  height: number;
  polygon_points: any[] | null;
}

export interface RoadIssueInsertData {
  category: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  severity: string;
  status?: string;
  evidence_path?: string | null;
}

export interface AnalyticsSummaryResponse {
  totals: {
    totalInspections: number;
    totalDetections: number;
    totalUniquePotholes: number;
    avgDamagePercentage: number;
    totalRoadIssues: number;
    resolvedRoadIssues: number;
    scheduledRoadIssues: number;
    inspectingRoadIssues: number;
    reportedRoadIssues: number;
    resolutionRate: number;
  };
  monthlyTrends: Array<{
    month: string;
    inspections: number;
    detections: number;
  }>;
  riskDistribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  severityDistribution: {
    minor: number;
    moderate: number;
    high: number;
    critical: number;
  };
  issueStatusDistribution: {
    Reported: number;
    'In Inspection': number;
    'Scheduled for Repair': number;
    Resolved: number;
  };
  issueCategoryDistribution: Array<{
    category: string;
    count: number;
  }>;
}

// ==========================================
// Inspection Persistence
// ==========================================

/**
 * Save an inspection record. Returns the inserted inspection ID.
 */
export async function saveInspection(data: InspectionInsertData): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const hasLocation =
    data.latitude !== undefined &&
    data.latitude !== null &&
    data.longitude !== undefined &&
    data.longitude !== null;

  if (hasLocation) {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO inspections
          (image_filename, image_path, image_width, image_height, detection_count,
           unique_pothole_count, overall_risk, damage_percentage, confidence_threshold, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.image_filename,
          data.image_path,
          data.image_width,
          data.image_height,
          data.detection_count,
          data.unique_pothole_count ?? null,
          data.overall_risk,
          data.damage_percentage,
          data.confidence_threshold,
          data.latitude ?? null,
          data.longitude ?? null,
        ] as any[]
      );
      return result.insertId;
    } catch {
      // If latitude column isn't present, fall back to standard insert
    }
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO inspections
      (image_filename, image_path, image_width, image_height, detection_count,
       unique_pothole_count, overall_risk, damage_percentage, confidence_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.image_filename,
      data.image_path,
      data.image_width,
      data.image_height,
      data.detection_count,
      data.unique_pothole_count ?? null,
      data.overall_risk,
      data.damage_percentage,
      data.confidence_threshold,
    ] as any[]
  );

  return result.insertId;
}

/**
 * Save multiple detection records in a batch for a single inspection.
 */
export async function saveDetections(detections: DetectionInsertData[]): Promise<void> {
  if (detections.length === 0) return;

  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const sql = `INSERT INTO detections
    (inspection_id, class_name, confidence, severity, x, y, width, height, polygon_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  // Use a single connection for the batch to stay transactional
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const d of detections) {
      await conn.execute(sql, [
        d.inspection_id,
        d.class_name,
        d.confidence,
        d.severity,
        d.x,
        d.y,
        d.width,
        d.height,
        d.polygon_points ? JSON.stringify(d.polygon_points) : null,
      ]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Retrieve paginated inspections, most recent first.
 */
export async function getInspections(
  limit: number = 50,
  offset: number = 0
): Promise<{ inspections: InspectionRecord[]; total: number }> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const [countRows] = await pool.execute<any[]>('SELECT COUNT(*) as total FROM inspections');
  const total = countRows[0]?.total || 0;

  const [rows] = await pool.execute<any[]>(
    'SELECT * FROM inspections ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  return { inspections: rows as InspectionRecord[], total };
}

/**
 * Retrieve a single inspection by ID.
 */
export async function getInspectionById(id: number): Promise<InspectionRecord | null> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const [rows] = await pool.execute<any[]>(
    'SELECT * FROM inspections WHERE id = ?',
    [id]
  );

  return rows.length > 0 ? (rows[0] as InspectionRecord) : null;
}

/**
 * Retrieve all detections for a given inspection.
 */
export async function getDetectionsByInspectionId(inspectionId: number): Promise<DetectionRecord[]> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const [rows] = await pool.execute<any[]>(
    'SELECT * FROM detections WHERE inspection_id = ? ORDER BY id ASC',
    [inspectionId]
  );

  return rows as DetectionRecord[];
}

// ==========================================
// Road Issue Persistence
// ==========================================

const VALID_SEVERITIES = ['minor', 'moderate', 'high', 'critical'];
const VALID_STATUSES = ['Reported', 'In Inspection', 'Scheduled for Repair', 'Resolved'];

/**
 * Save a new road issue. Returns the inserted issue ID.
 */
export async function saveRoadIssue(data: RoadIssueInsertData): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const status = data.status || 'Reported';

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO road_issues
      (category, description, latitude, longitude, severity, status, evidence_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.category,
      data.description,
      data.latitude,
      data.longitude,
      data.severity,
      status,
      data.evidence_path || null,
    ]
  );

  return result.insertId;
}

/**
 * Retrieve paginated road issues, with optional status filter.
 */
export async function getRoadIssues(
  options: { limit?: number; offset?: number; status?: string } = {}
): Promise<{ issues: RoadIssueRecord[]; total: number }> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  let countSql = 'SELECT COUNT(*) as total FROM road_issues';
  let dataSql = 'SELECT * FROM road_issues';
  const params: any[] = [];

  if (options.status && VALID_STATUSES.includes(options.status)) {
    countSql += ' WHERE status = ?';
    dataSql += ' WHERE status = ?';
    params.push(options.status);
  }

  const [countRows] = await pool.execute<any[]>(countSql, params);
  const total = countRows[0]?.total || 0;

  dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const dataParams = [...params, limit, offset];

  const [rows] = await pool.execute<any[]>(dataSql, dataParams);

  return { issues: rows as RoadIssueRecord[], total };
}

/**
 * Retrieve a single road issue by ID.
 */
export async function getRoadIssueById(id: number): Promise<RoadIssueRecord | null> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const [rows] = await pool.execute<any[]>(
    'SELECT * FROM road_issues WHERE id = ?',
    [id]
  );

  return rows.length > 0 ? (rows[0] as RoadIssueRecord) : null;
}

/**
 * Update the status of a road issue.
 */
export async function updateRoadIssueStatus(id: number, status: string): Promise<boolean> {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE road_issues SET status = ? WHERE id = ?',
    [status, id]
  );

  return result.affectedRows > 0;
}

// ==========================================
// Historical Analytics Persistence
// ==========================================

/**
 * Calculates historical pavement telemetry and aggregate metrics from real MySQL records.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  // 1. Totals from inspections
  const [inspTotals]: any = await pool.execute(
    `SELECT 
       COUNT(*) as total_inspections,
       COALESCE(SUM(detection_count), 0) as total_detections,
       COALESCE(SUM(COALESCE(unique_pothole_count, detection_count)), 0) as total_unique_potholes,
       COALESCE(AVG(damage_percentage), 0) as avg_damage_percentage
     FROM inspections`
  );

  // 2. Totals from road_issues
  const [issueTotals]: any = await pool.execute(
    `SELECT 
       COUNT(*) as total_issues,
       COALESCE(SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END), 0) as resolved_issues,
       COALESCE(SUM(CASE WHEN status = 'Scheduled for Repair' THEN 1 ELSE 0 END), 0) as scheduled_issues,
       COALESCE(SUM(CASE WHEN status = 'In Inspection' THEN 1 ELSE 0 END), 0) as inspecting_issues,
       COALESCE(SUM(CASE WHEN status = 'Reported' THEN 1 ELSE 0 END), 0) as reported_issues
     FROM road_issues`
  );

  // 3. Monthly trends (last 12 months)
  const [monthlyRows]: any = await pool.execute(
    `SELECT 
       DATE_FORMAT(created_at, '%Y-%m') as month,
       COUNT(*) as inspections,
       COALESCE(SUM(detection_count), 0) as detections
     FROM inspections
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC
     LIMIT 12`
  );

  // 4. Risk distribution
  const [riskRows]: any = await pool.execute(
    `SELECT overall_risk, COUNT(*) as count FROM inspections GROUP BY overall_risk`
  );
  const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  if (Array.isArray(riskRows)) {
    for (const r of riskRows) {
      if (r.overall_risk in riskDistribution) {
        riskDistribution[r.overall_risk as keyof typeof riskDistribution] = Number(r.count);
      }
    }
  }

  // 5. Severity distribution from detections
  const [sevRows]: any = await pool.execute(
    `SELECT severity, COUNT(*) as count FROM detections GROUP BY severity`
  );
  const severityDistribution = { minor: 0, moderate: 0, high: 0, critical: 0 };
  if (Array.isArray(sevRows)) {
    for (const r of sevRows) {
      const sev = String(r.severity).toLowerCase();
      if (sev in severityDistribution) {
        severityDistribution[sev as keyof typeof severityDistribution] = Number(r.count);
      }
    }
  }

  // 6. Issue status distribution
  const issueStatusDistribution = {
    Reported: Number(issueTotals[0]?.reported_issues || 0),
    'In Inspection': Number(issueTotals[0]?.inspecting_issues || 0),
    'Scheduled for Repair': Number(issueTotals[0]?.scheduled_issues || 0),
    Resolved: Number(issueTotals[0]?.resolved_issues || 0),
  };

  // 7. Issue category distribution
  const [catRows]: any = await pool.execute(
    `SELECT category, COUNT(*) as count FROM road_issues GROUP BY category ORDER BY count DESC`
  );
  const issueCategoryDistribution = Array.isArray(catRows)
    ? catRows.map((r: any) => ({
        category: String(r.category),
        count: Number(r.count),
      }))
    : [];

  const totalRoadIssues = Number(issueTotals[0]?.total_issues || 0);
  const resolvedRoadIssues = Number(issueTotals[0]?.resolved_issues || 0);
  const resolutionRate = totalRoadIssues > 0
    ? parseFloat(((resolvedRoadIssues / totalRoadIssues) * 100).toFixed(1))
    : 0;

  return {
    totals: {
      totalInspections: Number(inspTotals[0]?.total_inspections || 0),
      totalDetections: Number(inspTotals[0]?.total_detections || 0),
      totalUniquePotholes: Number(inspTotals[0]?.total_unique_potholes || 0),
      avgDamagePercentage: parseFloat(Number(inspTotals[0]?.avg_damage_percentage || 0).toFixed(2)),
      totalRoadIssues,
      resolvedRoadIssues,
      scheduledRoadIssues: Number(issueTotals[0]?.scheduled_issues || 0),
      inspectingRoadIssues: Number(issueTotals[0]?.inspecting_issues || 0),
      reportedRoadIssues: Number(issueTotals[0]?.reported_issues || 0),
      resolutionRate,
    },
    monthlyTrends: Array.isArray(monthlyRows)
      ? monthlyRows.map((r: any) => ({
          month: String(r.month),
          inspections: Number(r.inspections),
          detections: Number(r.detections),
        }))
      : [],
    riskDistribution,
    severityDistribution,
    issueStatusDistribution,
    issueCategoryDistribution,
  };
}

export { VALID_SEVERITIES, VALID_STATUSES };
