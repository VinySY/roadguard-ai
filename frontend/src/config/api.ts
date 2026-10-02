/**
 * RoadGuard AI — Frontend API Configuration
 * 
 * In local development, defaults to an empty string so requests (e.g. /api/detect)
 * are routed through Vite's local dev server proxy to http://localhost:3001.
 * 
 * In production (e.g. on Vercel), set VITE_API_BASE_URL to your deployed
 * backend URL (e.g. https://roadguard-backend.onrender.com).
 */

const rawBaseUrl = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  ''
).trim();

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
