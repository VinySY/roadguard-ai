import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  ArrowRight, 
  CheckCircle2, 
  ShieldAlert, 
  Calendar, 
  MapPin, 
  Layers, 
  FileJson,
  AlertCircle,
  Clock,
  RefreshCw,
  Database
} from 'lucide-react';
import { DetectionResult, NavigationTab, PotholeSeverity } from '../types/detection';
import { 
  fetchInspections, 
  fetchInspectionDetections, 
  InspectionRecord, 
  DetectionRecord 
} from '../services/api';

interface ReportsViewProps {
  latestResult: DetectionResult | null;
  onNavigate: (tab: NavigationTab) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  latestResult,
  onNavigate,
}) => {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [inspectionDetections, setInspectionDetections] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingDetections, setLoadingDetections] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadInspectionsList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchInspections(50, 0);
      setInspections(data.inspections || []);
      if (data.inspections && data.inspections.length > 0 && selectedInspectionId === null) {
        // Default to most recent inspection
        selectInspection(data.inspections[0]);
      }
    } catch (err: any) {
      console.warn('Failed to load inspections:', err.message);
      setError(err.message || 'Failed to connect to database');
    } finally {
      setLoading(false);
    }
  };

  const selectInspection = async (insp: InspectionRecord) => {
    setSelectedInspectionId(insp.id);
    setSelectedInspection(insp);
    try {
      setLoadingDetections(true);
      const data = await fetchInspectionDetections(insp.id);
      setInspectionDetections(data.detections || []);
    } catch (err: any) {
      console.warn(`Failed to load detections for inspection #${insp.id}:`, err.message);
    } finally {
      setLoadingDetections(false);
    }
  };

  useEffect(() => {
    loadInspectionsList();
  }, []);

  const handleDownloadJSON = () => {
    if (!selectedInspection) return;
    const exportPayload = {
      inspection: selectedInspection,
      detections: inspectionDetections,
      exportedAt: new Date().toISOString(),
      source: 'RoadGuard MySQL Database'
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadguard-inspection-${selectedInspection.id}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const overallRisk = selectedInspection?.overall_risk || 'LOW';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            STRUCTURAL AUDITS & ARCHIVES
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Road Inspection Reports
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Database-backed historical road condition dossiers, polygon breakdowns, and defect inventories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadInspectionsList}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>

          {selectedInspection && (
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Download JSON Dossier</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('detect')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <span>Launch Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading && inspections.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-400 font-mono">
          Loading historical inspection dossiers from MySQL...
        </div>
      ) : inspections.length === 0 ? (
        /* Empty State */
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No Inspection Records in Database</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Run an AI detection scan in the studio to automatically generate and persist a structured road condition dossier.
            </p>
          </div>
          <button
            onClick={() => onNavigate('detect')}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
          >
            Launch Detection Studio
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Inspection Records Sidebar / Selector */}
          <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-white uppercase">
                  Archived Scans ({inspections.length})
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                  MYSQL
                </span>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {inspections.map((insp) => {
                  const isSelected = selectedInspectionId === insp.id;
                  const riskBadge = 
                    insp.overall_risk === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                    insp.overall_risk === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                    insp.overall_risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-emerald-500/20 text-emerald-400';

                  return (
                    <div
                      key={insp.id}
                      onClick={() => selectInspection(insp)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1.5 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-400">
                          #{insp.id}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${riskBadge}`}>
                          {insp.overall_risk}
                        </span>
                      </div>

                      <h4 className="font-semibold text-white truncate text-[11px]">
                        {insp.image_filename}
                      </h4>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-850">
                        <span>{insp.detection_count} defects</span>
                        <span>{new Date(insp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500">
              Select any past inspection to view full defect details.
            </div>
          </div>

          {/* Active Dossier Details (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {selectedInspection ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                      <span className="font-bold">INSPECTION DOSSIER #{selectedInspection.id}</span>
                      <span>·</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> PERSISTED IN MYSQL
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Pavement Surface Damage Report — {selectedInspection.image_filename}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedInspection.latitude != null && selectedInspection.longitude != null && (
                      <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{Number(selectedInspection.latitude).toFixed(6)}°, {Number(selectedInspection.longitude).toFixed(6)}°</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(selectedInspection.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Key Dossier Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Defects Detected</span>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                      {selectedInspection.detection_count}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Pothole cavities</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Assessed Risk</span>
                    <div className={`text-2xl font-black font-mono mt-1 ${
                      overallRisk === 'CRITICAL' ? 'text-red-400' :
                      overallRisk === 'HIGH' ? 'text-orange-400' :
                      overallRisk === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {overallRisk}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Structural rating</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Damage Area</span>
                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {selectedInspection.damage_percentage}%
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Of road surface</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Image Resolution</span>
                    <div className="text-lg font-bold text-white font-mono mt-2 truncate">
                      {selectedInspection.image_width} &times; {selectedInspection.image_height}px
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Conf &ge; {selectedInspection.confidence_threshold}%
                    </span>
                  </div>
                </div>

                {/* Structured Defect Breakdown Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Defect Breakdown Inventory ({inspectionDetections.length})
                    </h4>
                    {loadingDetections && (
                      <span className="text-[10px] font-mono text-amber-400 animate-pulse">
                        Loading coordinates...
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4">Index</th>
                          <th className="py-2.5 px-4">Class</th>
                          <th className="py-2.5 px-4">Confidence</th>
                          <th className="py-2.5 px-4">Centroid (X, Y)</th>
                          <th className="py-2.5 px-4">Bounding Box</th>
                          <th className="py-2.5 px-4">Polygon Mask</th>
                          <th className="py-2.5 px-4">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                        {inspectionDetections.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500 text-xs font-mono">
                              {loadingDetections ? 'Fetching defect records...' : 'No individual detection points stored.'}
                            </td>
                          </tr>
                        ) : (
                          inspectionDetections.map((d, idx) => {
                            const conf = typeof d.confidence === 'number' ? d.confidence : parseFloat(d.confidence);
                            const x = Math.round(typeof d.x === 'number' ? d.x : parseFloat(d.x));
                            const y = Math.round(typeof d.y === 'number' ? d.y : parseFloat(d.y));
                            const w = Math.round(typeof d.width === 'number' ? d.width : parseFloat(d.width));
                            const h = Math.round(typeof d.height === 'number' ? d.height : parseFloat(d.height));
                            const sev = (d.severity || 'moderate').toLowerCase() as PotholeSeverity;
                            const ptsCount = Array.isArray(d.polygon_points) ? d.polygon_points.length : null;

                            return (
                              <tr key={d.id || idx} className="hover:bg-slate-850/50 transition-colors">
                                <td className="py-2.5 px-4 font-bold text-slate-400">#{idx + 1}</td>
                                <td className="py-2.5 px-4 font-semibold text-white">{d.class_name || 'pothole'}</td>
                                <td className="py-2.5 px-4 text-amber-400">{(conf * 100).toFixed(1)}%</td>
                                <td className="py-2.5 px-4 text-slate-300">({x}, {y})</td>
                                <td className="py-2.5 px-4 text-slate-300">{w} &times; {h}px</td>
                                <td className="py-2.5 px-4 text-slate-400">{ptsCount ? `${ptsCount} vertices` : 'Bounding box'}</td>
                                <td className="py-2.5 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    sev === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                    sev === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                    sev === 'moderate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}>
                                    {sev}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Database Source Notice */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400 leading-relaxed">
                  <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200">Database Record Verified:</strong>
                    <span> Inspection record #{selectedInspection.id} is stored persistently in MySQL. All spatial bounding boxes and segmentation polygon points are linked to this audit trail.</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
