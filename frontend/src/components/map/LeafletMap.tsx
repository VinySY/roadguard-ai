import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoadIssue, LocationCoordinates, UserRole, SeverityLevel } from '../../types';
import { getCurrentBrowserLocation, DEFAULT_MUNICIPAL_CENTER, calculateDistanceKm } from '../../services/location';
import {
  AVAILABLE_MAP_STYLES,
  DEFAULT_MAP_STYLE,
  MAP_STYLES,
  MapStyleId,
} from '../../config/map';
import { Crosshair, AlertCircle, Navigation, Compass, Layers, MapPin } from 'lucide-react';

interface LeafletMapProps {
  issues: RoadIssue[];
  role: UserRole;
  userLocation: LocationCoordinates | null;
  onLocationUpdate?: (coords: LocationCoordinates) => void;
  onSelectIssue?: (issue: RoadIssue) => void;
  selectedIssueId?: string;
  allowPickLocation?: boolean;
  onPickLocation?: (coords: LocationCoordinates) => void;
  height?: string;
  workerId?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  issues,
  role,
  userLocation,
  onLocationUpdate,
  onSelectIssue,
  selectedIssueId,
  allowPickLocation = false,
  onPickLocation,
  height = '520px',
  workerId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const tileErrorCountRef = useRef(0);

  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'unavailable'>(
    userLocation ? 'granted' : 'idle'
  );
  const [filterSeverity, setFilterSeverity] = useState<SeverityLevel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeLayer, setActiveLayer] = useState<MapStyleId>(DEFAULT_MAP_STYLE);
  const [layerFallbackNotice, setLayerFallbackNotice] = useState<string | null>(null);

  // Filter issues based on role:
  // - Worker: only assigned issues
  // - Citizen: issues around them (or all if no location yet)
  // - Inspector: full municipal filtering
  const visibleIssues = issues.filter((issue) => {
    if (role === 'worker' && workerId) {
      if (issue.assignedWorkerId !== workerId) return false;
    }
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) {
      return false;
    }
    if (filterStatus !== 'all' && issue.status !== filterStatus) {
      return false;
    }
    return true;
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [DEFAULT_MUNICIPAL_CENTER.lat, DEFAULT_MUNICIPAL_CENTER.lng];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: userLocation ? 14 : 13,
      zoomControl: false,
    });

    const initialStyle = MAP_STYLES[DEFAULT_MAP_STYLE];
    L.tileLayer(initialStyle.url, {
      attribution: initialStyle.attribution,
      maxZoom: initialStyle.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Click handler for picking location (e.g. in reporting flow)
    if (allowPickLocation) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;

        if (pickMarkerRef.current) {
          pickMarkerRef.current.setLatLng([lat, lng]);
        } else {
          pickMarkerRef.current = L.marker([lat, lng], {
            icon: L.divIcon({
              className: 'roadguard-temp-pin',
              html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#f59e0b;transform:rotate(-45deg);border:2px solid #0f172a;box-shadow:0 4px 12px rgba(0,0,0,.4)"></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 26],
            }),
          }).addTo(map);
        }

        if (onPickLocation) {
          onPickLocation({
            lat,
            lng,
            street: `Pinned Point (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`,
            area: 'Selected On Map',
          });
        }
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tiles when the user switches map style. Streets remains the
  // default; the optional CARTO layer automatically falls back to Streets if
  // its tiles fail, so a bad configuration can never leave a blank map.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const style = MAP_STYLES[activeLayer] || MAP_STYLES[DEFAULT_MAP_STYLE];
    tileErrorCountRef.current = 0;
    setLayerFallbackNotice(null);

    const tiles = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: style.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    tiles.on('tileerror', () => {
      tileErrorCountRef.current += 1;
      if (style.optional && tileErrorCountRef.current >= 3 && activeLayer !== 'streets') {
        setLayerFallbackNotice('CARTO tiles are unavailable — switched to Streets.');
        setActiveLayer('streets');
      }
    });
  }, [activeLayer]);

  // Handle explicit "Use My Location"
  const handleRequestLocation = async () => {
    setLocationStatus('locating');
    const result = await getCurrentBrowserLocation();

    if (result.status === 'granted' && result.coords) {
      setLocationStatus('granted');
      if (onLocationUpdate) {
        onLocationUpdate(result.coords);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([result.coords.lat, result.coords.lng], 15, {
          duration: 1.2,
        });
      }
    } else if (result.status === 'denied') {
      setLocationStatus('denied');
    } else {
      setLocationStatus('unavailable');
    }
  };

  // Update User Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full bg-blue-500/20 animate-ping"></div>
          <div class="relative w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg"></div>
          <div class="absolute top-5 bg-slate-900/90 text-blue-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-blue-500/30 whitespace-nowrap">
            You are here
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: userHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
      marker.bindPopup(
        `<div class="p-1 font-sans text-xs">
          <strong class="text-blue-600 block">Your Current Location</strong>
          <span class="text-slate-600">${userLocation.street || userLocation.area || 'Verified GPS location'}</span>
        </div>`
      );
      userMarkerRef.current = marker;
    }
  }, [userLocation]);

  // Update Road Issue Markers
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.clearLayers();

    visibleIssues.forEach((issue) => {
      const isSelected = issue.id === selectedIssueId;
      const severityColor =
        issue.severity === 'critical'
          ? '#EF4444'
          : issue.severity === 'high'
          ? '#F59E0B'
          : issue.severity === 'medium'
          ? '#3B82F6'
          : '#10B981';

      const statusBadge =
        issue.status === 'resolved'
          ? 'Resolved'
          : issue.status === 'in_repair'
          ? 'In Repair'
          : issue.status === 'inspection_scheduled'
          ? 'Inspection'
          : 'Reported';

      const markerHtml = `
        <div class="group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${
          isSelected ? 'scale-125 z-50' : ''
        }">
          <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 ${
            isSelected ? 'border-white ring-2 ring-amber-400' : 'border-slate-900'
          }" style="background-color: ${severityColor};">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="absolute -top-7 hidden group-hover:flex items-center gap-1 bg-slate-900 text-slate-100 text-[11px] px-2 py-0.5 rounded shadow-xl border border-slate-700 whitespace-nowrap z-50">
            <span class="font-medium">${issue.referenceNumber}</span>
            <span class="text-slate-400">·</span>
            <span class="capitalize text-amber-400">${issue.severity}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-issue-marker',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([issue.location.lat, issue.location.lng], { icon: customIcon });

      const distanceStr =
        userLocation
          ? `${calculateDistanceKm(
              userLocation.lat,
              userLocation.lng,
              issue.location.lat,
              issue.location.lng
            )} km away`
          : '';

      const popupHtml = `
        <div class="p-2 min-w-[210px] text-slate-900 font-sans">
          <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
            <span class="text-xs font-mono font-semibold text-slate-800">${issue.referenceNumber}</span>
            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase tracking-wider">${statusBadge}</span>
          </div>
          <h4 class="text-xs font-semibold text-slate-900 mt-2 mb-1 line-clamp-1">${issue.title}</h4>
          <p class="text-[11px] text-slate-600 mb-2">${issue.location.street || issue.location.area || 'Site Road'}</p>
          ${distanceStr ? `<p class="text-[10px] font-mono text-blue-600 mb-2">📍 ${distanceStr}</p>` : ''}
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
            <span class="text-slate-500">Severity: <strong class="capitalize" style="color: ${severityColor}">${issue.severity}</strong></span>
            <button type="button" id="btn-view-${issue.id}" class="text-amber-600 hover:text-amber-700 font-semibold text-[11px]">Details &rarr;</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onSelectIssue) {
          onSelectIssue(issue);
        }
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-view-${issue.id}`);
        if (btn && onSelectIssue) {
          btn.onclick = () => onSelectIssue(issue);
        }
      });

      markersLayer.addLayer(marker);
    });
  }, [visibleIssues, selectedIssueId, userLocation, onSelectIssue]);

  return (
    <div className="roadguard-map-container relative z-0 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950 shadow-sm [isolation:isolate]">
      {/* Map Header / Location Bar */}
      <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 z-10 flex flex-wrap items-center justify-between gap-2 sm:left-3 sm:right-3 sm:top-3">
        {/* Location Status Badge / Action */}
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur-md sm:px-3">
          {locationStatus === 'granted' && userLocation ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"></span>
              <span className="shrink-0 font-medium text-slate-300">Location enabled</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="truncate font-mono text-[11px] text-slate-400">
                {userLocation.street || userLocation.area || `${userLocation.lat.toFixed(3)}, ${userLocation.lng.toFixed(3)}`}
              </span>
            </div>
          ) : locationStatus === 'denied' ? (
            <div className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Location access blocked.</span>
              <button
                type="button"
                onClick={handleRequestLocation}
                className="ml-1 shrink-0 font-medium underline hover:text-rose-300"
              >
                Try again
              </button>
            </div>
          ) : locationStatus === 'unavailable' ? (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Location unavailable.</span>
              <button
                type="button"
                onClick={handleRequestLocation}
                className="ml-1 shrink-0 font-medium underline hover:text-amber-300"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="hidden text-xs text-slate-300 sm:inline">General view (default city centre)</span>
              <span className="text-xs text-slate-300 sm:hidden">City centre</span>
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={locationStatus === 'locating'}
                className="rg-btn rg-btn-primary rg-btn-sm ml-1 shrink-0"
              >
                <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{locationStatus === 'locating' ? 'Locating…' : 'Use my location'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Basemap style switcher — Streets is always available */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/95 p-1 text-xs shadow-md backdrop-blur-md">
          <span className="hidden items-center gap-1 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-500 sm:inline-flex">
            <Layers className="h-3 w-3" aria-hidden="true" />
            Map
          </span>
          {AVAILABLE_MAP_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setActiveLayer(style.id)}
              aria-pressed={activeLayer === style.id}
              title={style.description}
              className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
                activeLayer === style.id
                  ? 'bg-slate-800 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {layerFallbackNotice && (
        <div className="absolute right-3 top-14 z-20 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-slate-900/95 px-2.5 py-1.5 text-[11px] text-amber-300 shadow-lg backdrop-blur-md">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {layerFallbackNotice}
        </div>
      )}

      {/* Role-specific overlay filters for Inspector */}
      {role === 'inspector' && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex max-w-[calc(100%-1.25rem)] flex-wrap items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md sm:bottom-3 sm:left-3 sm:right-auto sm:max-w-md sm:py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">Sev:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as typeof filterSeverity)}
              aria-label="Filter by severity"
              className="rg-select !w-auto !px-2 !py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className="rg-select !w-auto !px-2 !py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="reported">Reported</option>
              <option value="inspection_scheduled">Inspection</option>
              <option value="in_repair">Repair</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <span className="ml-auto font-mono text-[10px] tabular-nums text-slate-400 sm:ml-1 sm:text-[11px]">
            {visibleIssues.length}/{issues.length}
          </span>
        </div>
      )}

      {/* Worker Navigation Quick Bar */}
      {role === 'worker' && (
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-slate-900/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md sm:bottom-3 sm:left-3 sm:py-2">
          <Navigation className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-200">Route view:</span>
          <span className="font-mono font-medium text-amber-400">
            {visibleIssues.length} {visibleIssues.length === 1 ? 'site' : 'sites'}
          </span>
        </div>
      )}

      {/* Citizen Distance Bar */}
      {role === 'citizen' && (
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur-md sm:bottom-3 sm:left-3">
          <span>Road hazards</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="font-mono font-medium text-amber-400">{visibleIssues.length} nearby</span>
        </div>
      )}

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />
    </div>
  );
};
