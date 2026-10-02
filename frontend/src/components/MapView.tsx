import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Layers, 
  Filter, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  ExternalLink, 
  Crosshair, 
  Compass, 
  CheckCircle2, 
  Clock, 
  Navigation,
  ArrowRight,
  Eye,
  FileText
} from 'lucide-react';
import { NavigationTab, PotholeSeverity } from '../types/detection';
import { fetchRoadIssues, fetchInspections, RoadIssueRecord, InspectionRecord } from '../services/api';

interface MapViewProps {
  onNavigate: (tab: NavigationTab) => void;
}

interface MapItem {
  id: string;
  numericId: number;
  type: 'issue' | 'inspection';
  category: string;
  description: string;
  severity: PotholeSeverity;
  status?: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  detectionCount?: number;
  overallRisk?: string;
}

export const MapView: React.FC<MapViewProps> = ({ onNavigate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<RoadIssueRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'issue' | 'inspection'>('ALL');
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);

  // Load real data from MySQL
  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [issuesRes, inspRes] = await Promise.all([
        fetchRoadIssues('ALL', 200, 0).catch(() => ({ issues: [], total: 0 })),
        fetchInspections(200, 0).catch(() => ({ inspections: [], total: 0 })),
      ]);

      setIssues(issuesRes.issues || []);
      setInspections(inspRes.inspections || []);
    } catch (err: any) {
      console.error('Failed to load map data:', err);
      setError(err.message || 'Unable to connect to database for location telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, []);

  // Filter valid geolocated items
  const geolocatedItems = useMemo<MapItem[]>(() => {
    const items: MapItem[] = [];

    // Process road issues with valid coordinates
    issues.forEach((iss) => {
      const lat = typeof iss.latitude === 'string' ? parseFloat(iss.latitude) : iss.latitude;
      const lng = typeof iss.longitude === 'string' ? parseFloat(iss.longitude) : iss.longitude;

      if (lat !== null && lat !== undefined && lng !== null && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          items.push({
            id: `issue-${iss.id}`,
            numericId: iss.id,
            type: 'issue',
            category: iss.category || 'Pothole',
            description: iss.description,
            severity: (iss.severity || 'moderate').toLowerCase() as PotholeSeverity,
            status: iss.status || 'Reported',
            latitude: lat,
            longitude: lng,
            createdAt: iss.created_at,
          });
        }
      }
    });

    // Process inspections with valid coordinates
    inspections.forEach((insp) => {
      const lat = typeof insp.latitude === 'string' ? parseFloat(insp.latitude) : insp.latitude;
      const lng = typeof insp.longitude === 'string' ? parseFloat(insp.longitude) : insp.longitude;

      if (lat !== null && lat !== undefined && lng !== null && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          let sev: PotholeSeverity = 'moderate';
          if (insp.overall_risk === 'CRITICAL') sev = 'critical';
          else if (insp.overall_risk === 'HIGH') sev = 'high';
          else if (insp.overall_risk === 'LOW') sev = 'minor';

          items.push({
            id: `insp-${insp.id}`,
            numericId: insp.id,
            type: 'inspection',
            category: `AI Scan (${insp.detection_count} Cavities)`,
            description: `Automated inspection scan of ${insp.image_filename} with ${insp.damage_percentage}% damaged road surface area.`,
            severity: sev,
            latitude: lat,
            longitude: lng,
            createdAt: insp.created_at,
            detectionCount: insp.detection_count,
            overallRisk: insp.overall_risk,
          });
        }
      }
    });

    return items;
  }, [issues, inspections]);

  // Apply UI Filters
  const filteredItems = useMemo<MapItem[]>(() => {
    return geolocatedItems.filter((item) => {
      if (selectedType !== 'ALL' && item.type !== selectedType) return false;
      if (selectedSeverity !== 'ALL' && item.severity.toUpperCase() !== selectedSeverity) return false;
      if (selectedStatus !== 'ALL' && item.status && item.status !== selectedStatus) return false;
      return true;
    });
  }, [geolocatedItems, selectedType, selectedSeverity, selectedStatus]);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create map instance if not already created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20.5937, 78.9629], // Default overview center
        zoom: 4,
        zoomControl: false,
      });

      // Add Zoom Control at top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // OpenStreetMap Standard Tiles with dark styling filter
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const getSeverityColor = (sev: PotholeSeverity) => {
      switch (sev) {
        case 'critical': return '#EF4444';
        case 'high': return '#F97316';
        case 'moderate': return '#F59E0B';
        case 'minor':
        default: return '#10B981';
      }
    };

    const bounds = L.latLngBounds([]);

    filteredItems.forEach((item) => {
      const color = getSeverityColor(item.severity);
      const isIssue = item.type === 'issue';

      // Custom animated pulsing SVG marker
      const customIcon = L.divIcon({
        className: 'roadguard-map-marker',
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${color}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 22px; height: 22px; border-radius: 50%; background: #0F172A; border: 2.5px solid ${color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${color}80;">
              <div style="width: 7px; height: 7px; border-radius: 50%; background: ${color};"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: customIcon });

      const statusBadge = item.status 
        ? `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #1E293B; color: #CBD5E1; border: 1px solid #334155;">${item.status}</span>`
        : '';

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      popupContent.style.color = '#F8FAFC';
      popupContent.style.padding = '4px';
      popupContent.innerHTML = `
        <div style="min-width: 220px; font-size: 12px; line-height: 1.4;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #334155;">
            <span style="font-weight: 800; font-family: monospace; color: #F59E0B;">${isIssue ? 'ISSUE #' + item.numericId : 'INSPECTION #' + item.numericId}</span>
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${color};">${item.severity}</span>
          </div>
          <div style="font-weight: 700; color: #FFFFFF; font-size: 13px; margin-bottom: 4px;">${item.category}</div>
          <div style="color: #94A3B8; font-size: 11px; margin-bottom: 8px;">${item.description}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            ${statusBadge}
            <span style="font-size: 10px; font-family: monospace; color: #64748B;">${new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
          <div style="font-size: 10px; font-family: monospace; color: #94A3B8; margin-bottom: 8px;">
            GPS: ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}
          </div>
          <button id="inspect-btn-${item.id}" style="width: 100%; padding: 6px; background: #F59E0B; color: #090D16; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; font-size: 11px;">
            View Details &amp; Records &rarr;
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'roadguard-leaflet-popup',
      });

      marker.on('popupopen', () => {
        setSelectedItem(item);
        const btn = document.getElementById(`inspect-btn-${item.id}`);
        if (btn) {
          btn.onclick = () => {
            if (item.type === 'issue') {
              onNavigate('issues');
            } else {
              onNavigate('reports');
            }
          };
        }
      });

      marker.addTo(markersLayer);
      bounds.extend([item.latitude, item.longitude]);
    });

    if (filteredItems.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [filteredItems, onNavigate]);

  const handleFitAll = () => {
    if (!mapInstanceRef.current || filteredItems.length === 0) return;
    const bounds = L.latLngBounds(filteredItems.map(i => [i.latitude, i.longitude]));
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  const criticalCount = geolocatedItems.filter(i => i.severity === 'critical').length;
  const highCount = geolocatedItems.filter(i => i.severity === 'high').length;
  const openCount = geolocatedItems.filter(i => i.status !== 'Resolved').length;

  return (
    <div className="space-y-6 w-full">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              GIS ASSET TELEMETRY
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              LEAFLET + OPENSTREETMAP
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
            <MapPin className="w-6 h-6 text-amber-400" />
            <span>Interactive Road Condition Map</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time geospatial mapping of verified pothole cavities, citizen complaint dispatches, and automated inspection coordinates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMapData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Refresh database coordinates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh Map</span>
          </button>

          <button
            onClick={() => onNavigate('issues')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm shadow-amber-500/20 cursor-pointer"
          >
            <span>File New Hazard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Geospatial KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-500 text-[10px] uppercase block">GEOLOCATED DEFECTS</span>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {geolocatedItems.length}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Verified GPS pins in DB</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-500 text-[10px] uppercase block">CRITICAL CAVITIES</span>
          <div className="text-2xl font-black text-red-400 font-mono mt-1">
            {criticalCount}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Immediate repair hazards</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-500 text-[10px] uppercase block">HIGH SEVERITY</span>
          <div className="text-2xl font-black text-orange-400 font-mono mt-1">
            {highCount}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Structural deterioration</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-500 text-[10px] uppercase block">ACTIVE WORK ORDERS</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {openCount}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Unresolved roadway alerts</span>
        </div>
      </div>

      {/* Interactive Map Filter Ribbon */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Type Filter */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Layer:</span>
            </span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Sources ({geolocatedItems.length})</option>
              <option value="issue">Citizen Complaints ({geolocatedItems.filter(i => i.type === 'issue').length})</option>
              <option value="inspection">AI Camera Scans ({geolocatedItems.filter(i => i.type === 'inspection').length})</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>Severity:</span>
            </span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MODERATE">Moderate</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Reported">Reported</option>
              <option value="In Inspection">In Inspection</option>
              <option value="Scheduled for Repair">Scheduled for Repair</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {filteredItems.length > 0 && (
          <button
            onClick={handleFitAll}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-mono text-[11px] transition-colors cursor-pointer"
          >
            <Crosshair className="w-3 h-3 text-amber-400" />
            <span>Fit All Pins ({filteredItems.length})</span>
          </button>
        )}
      </div>

      {/* Main Map Stage Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#090D16] min-h-[520px]">
        {/* Leaflet Map DOM Element */}
        <div
          ref={mapContainerRef}
          className="w-full h-[520px] z-0"
          style={{ background: '#0F172A' }}
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-xs font-mono text-slate-300">Loading Geospatial Road Telemetry...</span>
          </div>
        )}

        {/* Database Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center p-6 text-center gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <h3 className="text-base font-bold text-white">Database Connection Failed</h3>
            <p className="text-xs text-slate-400 max-w-md font-mono">{error}</p>
            <button
              onClick={loadMapData}
              className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Honest Empty State When No GPS Records Exist in DB */}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Compass className="w-7 h-7 stroke-[1.8]" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                GEOSPATIAL COORDINATES
              </span>
              <h3 className="text-lg font-bold text-white">
                No Geolocated Road Defects Matching Filters
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                {geolocatedItems.length === 0 
                  ? 'No GPS coordinates found in database records yet. File a road issue with latitude/longitude coordinates or upload photos with EXIF GPS to place pins automatically.'
                  : 'No defect markers match the active severity or status filters. Try clearing your filters.'}
              </p>
            </div>

            <div className="flex gap-2">
              {geolocatedItems.length > 0 ? (
                <button
                  onClick={() => {
                    setSelectedSeverity('ALL');
                    setSelectedStatus('ALL');
                    setSelectedType('ALL');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Reset Map Filters
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('issues')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  File Geolocated Complaint
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Item Telemetry Sidebar Card */}
      {selectedItem && (
        <div className="bg-slate-900/60 border border-amber-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-amber-400">
                {selectedItem.type === 'issue' ? `ROAD ISSUE #${selectedItem.numericId}` : `AI SCAN #${selectedItem.numericId}`}
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {selectedItem.severity} Severity
              </span>
              {selectedItem.status && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {selectedItem.status}
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-white">{selectedItem.category}</h4>
            <p className="text-xs text-slate-300">{selectedItem.description}</p>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 pt-1">
              <span>GPS: {selectedItem.latitude.toFixed(6)}°, {selectedItem.longitude.toFixed(6)}°</span>
              <span>·</span>
              <span>Logged: {new Date(selectedItem.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedItem.type === 'issue') {
                onNavigate('issues');
              } else {
                onNavigate('reports');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <span>{selectedItem.type === 'issue' ? 'Open Work Order' : 'Open Inspection Report'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
