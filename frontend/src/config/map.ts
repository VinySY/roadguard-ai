/**
 * Map provider configuration.
 *
 * Streets (OpenStreetMap) is the default, always-available basemap.
 * CARTO is optional and only appears when an explicit tile template is
 * configured through VITE_CARTO_TILE_URL. No paid key is required for the
 * default experience, and a missing CARTO configuration can never leave the
 * map blank.
 */

export type MapStyleId = 'streets' | 'carto';

export interface MapStyleDefinition {
  id: MapStyleId;
  label: string;
  description: string;
  url: string;
  attribution: string;
  maxZoom: number;
  optional: boolean;
}

const STREETS_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function readOptionalCartoTemplate(): string | null {
  const configured = (import.meta.env.VITE_CARTO_TILE_URL as string | undefined)?.trim();
  if (!configured) return null;
  if (!/^https:\/\//i.test(configured)) return null;
  if (!configured.includes('{z}') || !configured.includes('{x}') || !configured.includes('{y}')) {
    return null;
  }
  return configured;
}

const cartoTemplate = readOptionalCartoTemplate();

export const CARTO_ENABLED = Boolean(cartoTemplate);

export const MAP_STYLES: Record<MapStyleId, MapStyleDefinition> = {
  streets: {
    id: 'streets',
    label: 'Streets',
    description: 'OpenStreetMap road detail',
    url: STREETS_URL,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    optional: false,
  },
  carto: {
    id: 'carto',
    label: 'CARTO Dark',
    description: 'Optional dark basemap',
    url: cartoTemplate || CARTO_DARK_URL,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    optional: true,
  },
};

export const DEFAULT_MAP_STYLE: MapStyleId = 'streets';

export const AVAILABLE_MAP_STYLES: MapStyleDefinition[] = [
  MAP_STYLES.streets,
  ...(CARTO_ENABLED ? [MAP_STYLES.carto] : []),
];
