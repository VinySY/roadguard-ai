/**
 * Shared Roboflow configuration for RoadGuard AI.
 *
 * RoadGuard AI runs inference against Roboflow's Serverless Cloud API using a
 * deployed model ID (`<workspace>/<model-slug>`). The legacy project/version
 * path (`outline.roboflow.com/<project>/<version>`) is intentionally no longer
 * used: project version 1 resolves to the older YOLOv11n-seg model, while the
 * RF-DETR segmentation model is published under its own model ID.
 *
 * Model ID reference:
 *   govindsy43564-gmail-com/pothole-detection-itsgr-1-rfdetr-seg-medium-t3
 *
 * The model ID is configuration, not a secret. The API key stays in
 * `ROBOFLOW_API_KEY` (backend/.env, never committed).
 */

export const ROBOFLOW_SERVERLESS_BASE_URL = 'https://serverless.roboflow.com';

export const DEFAULT_ROBOFLOW_WORKSPACE = 'govindsy43564-gmail-com';
export const DEFAULT_ROBOFLOW_PROJECT = 'pothole-detection-itsgr';
export const DEFAULT_ROBOFLOW_VERSION = '1';
export const DEFAULT_ROBOFLOW_TASK_TYPE = 'instance-segmentation';
export const DEFAULT_ROBOFLOW_MODEL_ID =
  `${DEFAULT_ROBOFLOW_WORKSPACE}/${DEFAULT_ROBOFLOW_PROJECT}-${DEFAULT_ROBOFLOW_VERSION}-rfdetr-seg-medium-t3`;

export interface RoboflowConfig {
  workspace: string;
  project: string;
  version: string;
  /** Deployed model ID in `<workspace>/<model-slug>` form. */
  modelId: string;
  taskType: string;
  /** True when an API key is present. The key itself is never exposed. */
  apiKeyConfigured: boolean;
}

function readEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes API keys from environment variables. Handles raw keys, wrapped
 * quotes, and accidental `Bearer ` prefixes. Never logs the key.
 */
export function sanitizeApiKey(raw: string | undefined = process.env.ROBOFLOW_API_KEY): string {
  if (!raw) return '';
  return raw
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

/**
 * Reads the Roboflow configuration. `ROBOFLOW_MODEL_ID` is authoritative for
 * inference; workspace/project/version are kept for metadata and for building
 * human-readable health output.
 */
export function getRoboflowConfig(env: NodeJS.ProcessEnv = process.env): RoboflowConfig {
  const workspace = readEnv(env, 'ROBOFLOW_WORKSPACE') ?? DEFAULT_ROBOFLOW_WORKSPACE;
  const project = readEnv(env, 'ROBOFLOW_PROJECT') ?? DEFAULT_ROBOFLOW_PROJECT;
  const version = readEnv(env, 'ROBOFLOW_VERSION') ?? DEFAULT_ROBOFLOW_VERSION;
  const modelId = readEnv(env, 'ROBOFLOW_MODEL_ID') ?? DEFAULT_ROBOFLOW_MODEL_ID;

  return {
    workspace,
    project,
    version,
    modelId,
    taskType: DEFAULT_ROBOFLOW_TASK_TYPE,
    apiKeyConfigured: sanitizeApiKey(env.ROBOFLOW_API_KEY).length > 0,
  };
}

/** Converts a 0–100 percentage to the 0–1 fraction Roboflow expects. */
export function percentToFraction(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}

export interface InferenceQuery {
  /** Confidence threshold as a 0–100 percentage (RoadGuard's public contract). */
  confidencePercent?: number;
  /** Overlap threshold as a 0–100 percentage (RoadGuard's public contract). */
  overlapPercent?: number;
}

/**
 * Builds a Serverless Cloud API inference URL for a deployed model ID.
 *
 * Serverless expects `/<workspace>/<model-slug>` and fractional
 * `confidence`/`overlap` values (0–1), so percentages are converted here.
 */
export function buildServerlessInferenceUrl(modelId: string, query: InferenceQuery = {}): string {
  const segments = modelId
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length !== 2) {
    throw new Error(
      `Invalid Roboflow model ID "${modelId}". Expected "<workspace>/<model-slug>".`,
    );
  }

  const url = new URL(
    `${ROBOFLOW_SERVERLESS_BASE_URL}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`,
  );

  if (query.confidencePercent !== undefined) {
    url.searchParams.set('confidence', String(percentToFraction(query.confidencePercent)));
  }
  if (query.overlapPercent !== undefined) {
    url.searchParams.set('overlap', String(percentToFraction(query.overlapPercent)));
  }

  return url.toString();
}

/** Metadata URL used by the health probe. Authentication goes in a header. */
export function buildModelsMetadataUrl(config: RoboflowConfig): string {
  return `https://api.roboflow.com/${encodeURIComponent(config.workspace)}/${encodeURIComponent(config.project)}/models`;
}
