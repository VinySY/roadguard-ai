/**
 * Input validation utilities for RoadGuard AI API endpoints.
 * 
 * Keeps validation simple and dependency-free.
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates that a number is within range (inclusive).
 */
function validateRange(
  value: any,
  field: string,
  min: number,
  max: number,
  errors: ValidationError[]
): number | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === undefined || num === null || isNaN(num)) {
    errors.push({ field, message: `${field} is required and must be a number` });
    return null;
  }
  if (num < min || num > max) {
    errors.push({ field, message: `${field} must be between ${min} and ${max}` });
    return null;
  }
  return num;
}

/**
 * Validates that a string is one of the allowed values.
 */
function validateEnum(
  value: any,
  field: string,
  allowed: readonly string[],
  errors: ValidationError[],
  required: boolean = true
): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: `${field} is required` });
    }
    return null;
  }
  const str = String(value);
  if (!allowed.includes(str)) {
    errors.push({ field, message: `${field} must be one of: ${allowed.join(', ')}` });
    return null;
  }
  return str;
}

/**
 * Validates that a string is present and non-empty.
 */
function validateRequiredString(
  value: any,
  field: string,
  errors: ValidationError[],
  maxLength: number = 2000
): string | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    errors.push({ field, message: `${field} is required` });
    return null;
  }
  const str = String(value).trim();
  if (str.length > maxLength) {
    errors.push({ field, message: `${field} must not exceed ${maxLength} characters` });
    return null;
  }
  return str;
}

// Supported values
const VALID_SEVERITIES = ['minor', 'moderate', 'high', 'critical'] as const;
const VALID_STATUSES = ['Reported', 'In Inspection', 'Scheduled for Repair', 'Resolved'] as const;
const VALID_CATEGORIES = [
  'Pothole', 'Road Damage', 'Cracked Road', 'Waterlogging',
  'Uneven Surface', 'Missing Road Marking', 'Other'
] as const;
const VALID_MEDIA_TYPES = ['image', 'video'] as const;
const MAX_MEDIA_PATH_LENGTH = 1024;
/** Compact detector geometry only — never inline base64 media. */
const MAX_DETECTION_METADATA_LENGTH = 1_000_000;

/**
 * Removes session-only blob URLs (useless after refresh) and inline data: media
 * so report JSON never becomes a media store. Geometry, class, confidence and
 * frame timestamps are preserved.
 */
function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Drop session-only and inline media references entirely. The detector
    // geometry in the same object is kept, but no base64 payload reaches MySQL.
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return undefined;
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeMetadataValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeMetadataValue(item, depth + 1);
      if (sanitized !== undefined) clone[key] = sanitized;
    }
    return clone;
  }

  return value;
}

function sanitizeMediaPath(
  value: unknown,
  field: string,
  errors: ValidationError[]
): string | null {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.length > MAX_MEDIA_PATH_LENGTH) {
    errors.push({ field, message: `${field} must not exceed ${MAX_MEDIA_PATH_LENGTH} characters` });
    return null;
  }
  if (str.startsWith('blob:') || str.startsWith('data:')) {
    errors.push({ field, message: `${field} must reference persisted server media, not a session-only URL` });
    return null;
  }
  if (str.includes('..') || /[\u0000-\u001f]/.test(str)) {
    errors.push({ field, message: `${field} contains an invalid path` });
    return null;
  }
  return str.replace(/\\/g, '/');
}

function sanitizeDetectionMetadata(
  value: unknown,
  field: string,
  errors: ValidationError[]
): unknown | null {
  if (value === undefined || value === null || value === '') return null;

  let parsed: unknown = value;
  if (typeof value === 'string') {
    if (value.length > MAX_DETECTION_METADATA_LENGTH) {
      errors.push({ field, message: `${field} is too large; store compact detector geometry only` });
      return null;
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      errors.push({ field, message: `${field} must be valid JSON` });
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push({ field, message: `${field} must be an object containing detector output` });
    return null;
  }

  const sanitized = sanitizeMetadataValue(parsed);

  let serialized: string;
  try {
    serialized = JSON.stringify(sanitized);
  } catch {
    errors.push({ field, message: `${field} could not be serialized` });
    return null;
  }
  if (serialized.length > MAX_DETECTION_METADATA_LENGTH) {
    errors.push({ field, message: `${field} is too large; store compact detector geometry only` });
    return null;
  }

  return sanitized;
}

export interface ValidatedRoadIssue {
  category: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  severity: string;
  status: string;
  media_type: 'image' | 'video';
  evidence_path: string | null;
  evidence_video_path: string | null;
  detection_metadata: unknown | null;
}

/**
 * Validates a road issue creation payload.
 */
export function validateRoadIssue(body: any): {
  valid: boolean;
  errors: ValidationError[];
  data?: ValidatedRoadIssue;
} {
  const errors: ValidationError[] = [];

  const category = validateEnum(body.category, 'category', VALID_CATEGORIES, errors);
  const description = validateRequiredString(body.description, 'description', errors, 5000);
  const severity = validateEnum(body.severity, 'severity', VALID_SEVERITIES, errors);

  // Latitude and longitude are optional but must be valid if provided
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (body.latitude !== undefined && body.latitude !== null && body.latitude !== '') {
    latitude = validateRange(body.latitude, 'latitude', -90, 90, errors);
  }
  if (body.longitude !== undefined && body.longitude !== null && body.longitude !== '') {
    longitude = validateRange(body.longitude, 'longitude', -180, 180, errors);
  }

  // Status defaults to 'Reported', validate if provided
  let status = 'Reported';
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    const validatedStatus = validateEnum(body.status, 'status', VALID_STATUSES, errors, false);
    if (validatedStatus) status = validatedStatus;
  }

  // Media fields are optional. Older clients still send only evidence_path.
  let media_type: 'image' | 'video' = 'image';
  if (body.media_type !== undefined && body.media_type !== null && body.media_type !== '') {
    const validatedMediaType = validateEnum(
      body.media_type,
      'media_type',
      VALID_MEDIA_TYPES,
      errors,
      false
    );
    if (validatedMediaType) media_type = validatedMediaType as 'image' | 'video';
  }

  const evidence_path = sanitizeMediaPath(body.evidence_path, 'evidence_path', errors);
  const evidence_video_path = sanitizeMediaPath(
    body.evidence_video_path,
    'evidence_video_path',
    errors
  );
  // Backwards-compatible inference for clients that send the video path alone.
  if (!body.media_type && evidence_video_path) {
    media_type = 'video';
  }
  const detection_metadata = sanitizeDetectionMetadata(
    body.detection_metadata,
    'detection_metadata',
    errors
  );

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      category: category!,
      description: description!,
      latitude,
      longitude,
      severity: severity!,
      status,
      media_type,
      evidence_path,
      evidence_video_path,
      detection_metadata,
    },
  };
}

/**
 * Validates a status update payload.
 */
export function validateStatusUpdate(body: any): {
  valid: boolean;
  errors: ValidationError[];
  status?: string;
} {
  const errors: ValidationError[] = [];
  const status = validateEnum(body.status, 'status', VALID_STATUSES, errors);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], status: status! };
}

/**
 * Validates a confidence value (0 to 1 or 0 to 100).
 */
export function validateConfidence(value: any): number | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return null;
  // Accept both 0-1 and 0-100 ranges
  if (num >= 0 && num <= 1) return num;
  if (num > 1 && num <= 100) return num;
  return null;
}

/**
 * Validates pagination parameters.
 */
export function validatePagination(query: any): { limit: number; offset: number } {
  let limit = parseInt(query.limit, 10);
  let offset = parseInt(query.offset, 10);

  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  if (isNaN(offset) || offset < 0) offset = 0;

  return { limit, offset };
}
