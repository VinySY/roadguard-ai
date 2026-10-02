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

export interface ValidatedRoadIssue {
  category: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  severity: string;
  status: string;
  evidence_path: string | null;
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

  const evidence_path = body.evidence_path ? String(body.evidence_path).trim() : null;

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
      evidence_path,
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
