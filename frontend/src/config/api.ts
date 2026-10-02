/**
 * RoadGuard AI — Frontend API Configuration
 * 
 * In local development, defaults to an empty string so requests (e.g. /api/detect)
 * are routed through Vite's local dev server proxy to http://localhost:3001.
 * 
 * In production (e.g. on Vercel), uses VITE_API_BASE_URL if set, or falls back
 * to the deployed production backend URL (https://roadguard-ai-8t84.onrender.com).
 */

const PRODUCTION_API_DEFAULT = 'https://roadguard-ai-8t84.onrender.com';

const rawBaseUrl = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.PROD ? PRODUCTION_API_DEFAULT : '')
).trim();

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

