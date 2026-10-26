import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Loader2, MapPin, X } from 'lucide-react';
import { LocationCoordinates } from '../../types';
import { DEFAULT_MUNICIPAL_CENTER, reverseGeocode } from '../../services/location';
import { isValidLatitude, isValidLongitude } from '../../services/media';
import { DEFAULT_MAP_STYLE, MAP_STYLES } from '../../config/map';

interface LocationPinPickerProps {
  isOpen: boolean;
  initialLocation?: LocationCoordinates | null;
  onConfirm: (coords: LocationCoordinates) => void;
  onCancel: () => void;
}

const STREETS_TILES = MAP_STYLES[DEFAULT_MAP_STYLE].url;

function pinIcon() {
  return L.divIcon({
    className: 'roadguard-temp-pin',
    html: `
      <div style="position:relative;width:28px;height:40px;">
        <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#f59e0b;transform:rotate(-45deg);border:2px solid #0f172a;box-shadow:0 4px 10px rgba(0,0,0,.35);"></div>
        <div style="position:absolute;top:7px;left:7px;width:14px;height:14px;border-radius:999px;background:#0f172a;"></div>
      </div>
    `,
    iconSize: [28, 40],
    iconAnchor: [14, 38],
  });
}

export const LocationPinPicker: React.FC<LocationPinPickerProps> = ({
  isOpen,
  initialLocation,
  onConfirm,
  onCancel,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState<string>('');
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const start = initialLocation && isValidLatitude(initialLocation.lat) && isValidLongitude(initialLocation.lng)
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : null;

    setDraft(start);
    setAddressLabel(start ? (initialLocation?.address || initialLocation?.street || '') : '');
    setError(null);

    const timer = window.setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const center = start || DEFAULT_MUNICIPAL_CENTER;
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: start ? 17 : 13,
        zoomControl: true,
      });

      L.tileLayer(STREETS_TILES, {
        attribution: MAP_STYLES[DEFAULT_MAP_STYLE].attribution,
        maxZoom: MAP_STYLES[DEFAULT_MAP_STYLE].maxZoom,
      }).addTo(map);

      mapRef.current = map;

      const placeMarker = (lat: number, lng: number) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { icon: pinIcon(), draggable: true }).addTo(map);
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            setDraft({ lat: pos.lat, lng: pos.lng });
          });
          markerRef.current = marker;
        }
      };

      if (start) {
        placeMarker(start.lat, start.lng);
      }

      map.on('click', (event: L.LeafletMouseEvent) => {
        const { lat, lng } = event.latlng;
        setDraft({ lat, lng });
        placeMarker(lat, lng);
      });

      map.invalidateSize();
    }, 50);

    return () => {
      window.clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [isOpen, initialLocation]);

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    setGeocoding(true);
    reverseGeocode(draft.lat, draft.lng)
      .then((geo) => {
        if (cancelled) return;
        setAddressLabel(geo.address || [geo.street, geo.area, geo.city].filter(Boolean).join(', '));
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft?.lat, draft?.lng]);

  // Escape cancels pin selection without closing the parent report flow.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!draft || !isValidLatitude(draft.lat) || !isValidLongitude(draft.lng)) {
      setError('Click the map to place a pin on the exact pothole location.');
      return;
    }

    onConfirm({
      lat: Number(draft.lat.toFixed(7)),
      lng: Number(draft.lng.toFixed(7)),
      address: addressLabel || undefined,
      street: addressLabel.split(',')[0]?.trim() || `Pinned ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`,
      area: 'Selected on map',
    });
  };

  return (
    <div className="rg-animate-fade fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-picker-title"
        aria-describedby="pin-picker-description"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-amber-500/40 bg-slate-900 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-amber-500/10 px-4 py-3">
          <div>
            <h3
              id="pin-picker-title"
              className="flex items-center gap-2 text-sm font-semibold text-amber-300"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Pin selection mode
            </h3>
            <p id="pin-picker-description" className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
              Click the road where the pothole is. Drag the pin to adjust. Map navigation still works with
              pinch/scroll.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rg-icon-btn"
            aria-label="Cancel pin selection"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative">
          <div ref={mapContainerRef} className="h-[52vh] min-h-[280px] w-full cursor-crosshair" />
          <div className="pointer-events-none absolute left-3 right-3 top-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-slate-950/90 px-3 py-1.5 text-[11px] font-medium text-amber-300">
              Selection mode: tap the exact road location
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-800 p-4">
          <div aria-live="polite" className="min-h-[2.5rem] space-y-1 text-xs">
            {draft ? (
              <>
                <div className="font-mono text-amber-400">
                  {draft.lat.toFixed(6)}°, {draft.lng.toFixed(6)}°
                </div>
                <div className="text-slate-400">
                  {geocoding
                    ? 'Looking up nearby address…'
                    : addressLabel || 'Address lookup optional — coordinates will still be saved.'}
                </div>
              </>
            ) : (
              <p className="text-slate-400">No pin yet. Click the map to drop a temporary marker.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="rg-btn rg-btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!draft}
              className="rg-btn rg-btn-primary"
            >
              {geocoding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Confirm location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
