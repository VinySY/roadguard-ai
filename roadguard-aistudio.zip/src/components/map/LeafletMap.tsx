import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoadIssue, LocationCoordinates, UserRole, SeverityLevel } from '../../types';
import { getCurrentBrowserLocation, DEFAULT_MUNICIPAL_CENTER, calculateDistanceKm } from '../../services/location';
import { Crosshair, MapPin, AlertCircle, CheckCircle2, ShieldAlert, Navigation, Layers, Compass } from 'lucide-react';

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

  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'unavailable'>(
    userLocation ? 'granted' : 'idle'
  );
  const [filterSeverity, setFilterSeverity] = useState<SeverityLevel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeLayer, setActiveLayer] = useState<'dark' | 'streets'>('dark');

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

    // High quality CartoDB Dark Matter tiles matching RoadGuard dark palette
    const tileLayerUrl =
      activeLayer === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tiles = L.tileLayer(tileLayerUrl, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Click handler for picking location (e.g. in reporting flow)
    if (allowPickLocation) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
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

  // Update tiles if layer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const tileLayerUrl =
      activeLayer === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileLayerUrl, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
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
            <button id="btn-view-${issue.id}" class="text-amber-600 hover:text-amber-700 font-semibold text-[11px]">Details &rarr;</button>
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
    <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner isolate">
      {/* Map Header / Location Bar */}
      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Location Status Badge / Action */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs shadow-lg max-w-full">
          {locationStatus === 'granted' && userLocation ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
              <span className="text-slate-300 font-medium shrink-0">Location Enabled</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono text-[11px] truncate">
                {userLocation.street || userLocation.area || `${userLocation.lat.toFixed(3)}, ${userLocation.lng.toFixed(3)}`}
              </span>
            </div>
          ) : locationStatus === 'denied' ? (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Location access blocked.</span>
              <button
                onClick={handleRequestLocation}
                className="underline hover:text-rose-300 font-medium ml-1 shrink-0"
              >
                Try Again
              </button>
            </div>
          ) : locationStatus === 'unavailable' ? (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Location unavailable.</span>
              <button
                onClick={handleRequestLocation}
                className="underline hover:text-amber-300 font-medium ml-1 shrink-0"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-300 text-xs hidden xs:inline sm:inline">General View (Default City Center)</span>
              <span className="text-slate-300 text-xs xs:hidden sm:hidden">City Center</span>
              <button
                onClick={handleRequestLocation}
                disabled={locationStatus === 'locating'}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-2 sm:px-2.5 py-1 rounded text-xs transition-colors shadow-sm ml-1 shrink-0"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{locationStatus === 'locating' ? 'Locating...' : 'Use My Location'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Layer Toggle */}
        <div className="pointer-events-auto flex items-center bg-slate-900/95 backdrop-blur-md p-0.5 sm:p-1 rounded-lg border border-slate-700/80 text-xs shadow-lg shrink-0">
          <button
            onClick={() => setActiveLayer('dark')}
            className={`px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeLayer === 'dark' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dark Carto
          </button>
          <button
            onClick={() => setActiveLayer('streets')}
            className={`px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeLayer === 'streets' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Streets
          </button>
        </div>
      </div>

      {/* Role-specific overlay filters for Inspector */}
      {role === 'inspector' && (
        <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 right-2.5 sm:right-auto z-20 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 sm:py-2 rounded-lg border border-slate-700/80 text-xs shadow-xl flex flex-wrap items-center gap-2 max-w-[calc(100%-1.25rem)] sm:max-w-md">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider">Sev:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="bg-slate-950 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All</option>
              <option value="reported">Reported</option>
              <option value="inspection_scheduled">Inspection</option>
              <option value="in_repair">Repair</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <span className="text-slate-400 font-mono text-[10px] sm:text-[11px] tabular-nums ml-auto sm:ml-1">
            {visibleIssues.length}/{issues.length}
          </span>
        </div>
      )}

      {/* Worker Navigation Quick Bar */}
      {role === 'worker' && (
        <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 z-20 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 sm:py-2 rounded-lg border border-amber-500/30 text-xs shadow-xl flex items-center gap-2">
          <Navigation className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-200 font-medium text-xs">Route View:</span>
          <span className="text-amber-400 font-mono font-medium">
            {visibleIssues.length} {visibleIssues.length === 1 ? 'Site' : 'Sites'}
          </span>
        </div>
      )}

      {/* Citizen Distance Bar */}
      {role === 'citizen' && (
        <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 z-20 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs shadow-xl text-slate-300 flex items-center gap-2">
          <span>Road hazards</span>
          <span className="text-slate-500">·</span>
          <span className="text-amber-400 font-mono font-medium">{visibleIssues.length} nearby</span>
        </div>
      )}

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />
    </div>
  );
};
