import { LocationCoordinates } from '../types';

export type LocationPermissionStatus = 'not_requested' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface LocationState {
  status: LocationPermissionStatus;
  coords: LocationCoordinates | null;
  errorMessage?: string;
  isDefaultFallback: boolean;
}

// Default regional municipal center (used ONLY for initial general map perspective, never labeled as user location)
export const DEFAULT_MUNICIPAL_CENTER: LocationCoordinates = {
  lat: 30.7333,
  lng: 76.7794,
  street: 'Municipal Zone Center, Sector 17',
  area: 'Central Corridor',
  city: 'Chandigarh',
  postalCode: '160017',
};

// Calculate distance in kilometers using Haversine formula
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Partial<LocationCoordinates>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RoadGuardAI-Municipal-Pothole-Management',
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || 'Municipal Roadway';
      const area = addr.suburb || addr.city_district || addr.neighbourhood || 'Urban Sector';
      const city = addr.city || addr.town || addr.county || 'Metropolitan Area';
      const postalCode = addr.postcode || '';

      return {
        address: data.display_name,
        street,
        area,
        city,
        postalCode,
      };
    }
  } catch (err) {
    console.warn('Reverse geocoding network unavailable, using coordinate label', err);
  }

  return {
    street: `Location ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
    area: 'Detected Coordinate Area',
    city: 'Municipal Region',
  };
}

export function getCurrentBrowserLocation(): Promise<{ coords: LocationCoordinates; status: LocationPermissionStatus }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      resolve({
        coords: { ...DEFAULT_MUNICIPAL_CENTER },
        status: 'unavailable',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        const geocoded = await reverseGeocode(lat, lng);

        resolve({
          coords: {
            lat,
            lng,
            accuracy,
            ...geocoded,
          },
          status: 'granted',
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            coords: null as any,
            status: 'denied',
          });
        } else {
          resolve({
            coords: null as any,
            status: 'unavailable',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  });
}
