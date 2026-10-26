import { getApiUrl } from '../config/api';
import potholeEvidence from '../assets/images/roadguard_pothole_evidence_1790958622590.jpg';
import heroInspection from '../assets/images/roadguard_hero_inspection_1790958611333.jpg';
import municipalOperations from '../assets/images/roadguard_municipal_operations_1790958647322.jpg';
import workerField from '../assets/images/roadguard_worker_field_1790958635986.jpg';
import heroRoad from '../assets/images/hero_road_inspection_1790353557267.jpg';
import potholeSample from '../assets/images/pothole_asphalt_sample_1790353573527.jpg';
import surveyVehicle from '../assets/images/survey_vehicle_view_1790353587244.jpg';

/**
 * Legacy demo records point at Vite source paths such as
 * `/src/assets/images/...`. Those work in dev but 404 in a production build.
 * Map the known project assets to their bundled URLs instead of dropping the
 * image. Unknown paths still fall through to the graceful unavailable state.
 */
const LEGACY_ASSET_URLS: Record<string, string> = {
  'roadguard_pothole_evidence_1790958622590.jpg': potholeEvidence,
  'roadguard_hero_inspection_1790958611333.jpg': heroInspection,
  'roadguard_municipal_operations_1790958647322.jpg': municipalOperations,
  'roadguard_worker_field_1790958635986.jpg': workerField,
  'hero_road_inspection_1790353557267.jpg': heroRoad,
  'pothole_asphalt_sample_1790353573527.jpg': potholeSample,
  'survey_vehicle_view_1790353587244.jpg': surveyVehicle,
};

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function matchLegacyAsset(value: string): string | null {
  if (!value.includes('/assets/images/') && !value.startsWith('assets/images/')) {
    return null;
  }
  const filename = value.split('/').pop()?.split('?')[0];
  if (!filename) return null;
  return LEGACY_ASSET_URLS[filename] || null;
}

/**
 * Converts stored image paths, relative API paths, and absolute URLs into a
 * browser-loadable URL. Returns null only when no usable source remains.
 */
export function resolveMediaUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const bundledAsset = matchLegacyAsset(value);
  if (bundledAsset) return bundledAsset;

  if (value.startsWith('/api/')) {
    return getApiUrl(value);
  }

  if (value.startsWith('/uploads/')) {
    return getApiUrl(`/api${value}`);
  }

  // Any other root-relative URL is a local/public asset and must not be
  // prefixed with the backend origin.
  if (value.startsWith('/')) {
    return value;
  }

  const withoutLeadingSlash = value.replace(/^\/+/, '').replace(/\\/g, '/');
  if (withoutLeadingSlash.startsWith('uploads/')) {
    return getApiUrl(`/api/${withoutLeadingSlash}`);
  }
  if (withoutLeadingSlash.startsWith('api/')) {
    return getApiUrl(`/${withoutLeadingSlash}`);
  }
  if (withoutLeadingSlash.startsWith('assets/')) {
    return `/${withoutLeadingSlash}`;
  }

  return getApiUrl(`/${withoutLeadingSlash}`);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not encode image evidence'));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read image evidence'));
    reader.readAsDataURL(blob);
  });
}

export async function uploadEvidenceFile(
  source: Blob | File,
  filename = 'complaint.jpg'
): Promise<{ url: string; path: string } | null> {
  const formData = new FormData();
  const name = source instanceof File ? source.name || filename : filename;
  formData.append('image', source, name);

  const response = await fetch(getApiUrl('/api/evidence'), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Evidence upload failed (HTTP ${response.status})`);
  }

  const json = await response.json();
  const url = typeof json.url === 'string' ? json.url : null;
  const path = typeof json.path === 'string' ? json.path : url;
  if (!url) return null;
  return { url: resolveMediaUrl(url) || url, path };
}

/**
 * Persist a complaint photograph so it remains visible after refresh.
 * Prefers the backend upload store; falls back to a data URL of the same photo.
 */
export async function persistEvidenceSource(
  source: Blob | File | string | null | undefined,
  filename?: string
): Promise<string | null> {
  if (!source) return null;

  if (typeof source === 'string') {
    const resolved = resolveMediaUrl(source);
    if (source.startsWith('blob:') || source.startsWith('data:')) {
      try {
        const res = await fetch(source);
        const blob = await res.blob();
        return persistEvidenceSource(blob, filename);
      } catch {
        return source.startsWith('data:') ? source : null;
      }
    }
    return resolved;
  }

  try {
    const uploaded = await uploadEvidenceFile(source, filename);
    if (uploaded?.url) return uploaded.url;
  } catch (err) {
    console.warn('Could not upload evidence to backend; storing encoded photograph locally.', err);
  }

  return blobToDataUrl(source);
}
