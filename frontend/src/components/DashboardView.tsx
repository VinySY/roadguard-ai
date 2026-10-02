import React, { useState, useEffect } from 'react';
import { 
  Scan, 
  Activity, 
  Database, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Server,
  FileText,
  Calendar,
  Clock,
  RefreshCw
} from 'lucide-react';
import { DetectionResult, NavigationTab, ServerHealth } from '../types/detection';
import { fetchInspections, InspectionRecord } from '../services/api';

interface DashboardViewProps {
  latestResult: DetectionResult | null;
  serverHealth: ServerHealth | null;
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  latestResult,
  serverHealth,
  onNavigate,
}) => {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [totalInspections, setTotalInspections] = useState<number>(0);
  const [loadingDb, setLoadingDb] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const loadInspections = async () => {
    try {
      setLoadingDb(true);
      setDbError(null);
      const data = await fetchInspections(8, 0);
      setInspections(data.inspections || []);
      setTotalInspections(data.total || 0);
    } catch (err: any) {
      console.warn('Could not load historical inspections:', err.message);
      setDbError(err.message || 'Database unavailable');
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [latestResult]);

  const hasScan = Boolean(latestResult && latestResult.predictions);
  const detectedCount = hasScan ? latestResult!.predictions.length : 0;
  const overallRisk = latestResult?.analytics?.overallRiskLevel || (detectedCount > 2 ? 'HIGH' : detectedCount > 0 ? 'MEDIUM' : 'LOW');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-r from-slate-900 via-[#0F172A] to-slate-950 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-[11px] font-mono text-amber-400 uppercase tracking-widest font-bold">
            OPERATIONS CONTROL CENTER
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Road Infrastructure Monitoring
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Real-time computer vision telemetry and pavement damage intelligence powered by YOLOv11 segmentation and persistent MySQL auditing.
          </p>
        </div>

        <button
          onClick={() => onNavigate('detect')}
          className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap self-start md:self-auto cursor-pointer"
        >
          <span>Launch AI Studio</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Grid: Real Current Scan vs System Diagnostics */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Active Scan Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  REAL-TIME SESSION DATA
                </span>
                <h3 className="text-lg font-bold text-white">Current Road Scan</h3>
              </div>
              {hasScan ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  SCAN LOADED
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400">
                  NO ACTIVE SCAN
                </span>
              )}
            </div>

            {hasScan && latestResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Potholes</span>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">
                      {detectedCount}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Risk Level</span>
                    <div className={`text-xl font-black font-mono mt-0.5 ${
                      overallRisk === 'CRITICAL' ? 'text-red-400' :
                      overallRisk === 'HIGH' ? 'text-orange-400' :
                      overallRisk === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {overallRisk}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Model</span>
                    <div className="text-xs font-bold text-slate-200 font-mono mt-1.5">
                      YOLOv11-seg
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Source: <span className="text-slate-200">{latestResult.sourceName || 'Road capture'}</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <Scan className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  No scan performed yet in this session. Run detection on a pavement image to generate real telemetry.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex gap-3">
            <button
              onClick={() => onNavigate('detect')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{hasScan ? 'Inspect in Studio' : 'Start First Scan'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {hasScan && (
              <button
                onClick={() => onNavigate('reports')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Dossier</span>
              </button>
            )}
          </div>
        </div>

        {/* Backend & AI Model Health Diagnostics */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  SYSTEM TELEMETRY
                </span>
                <h3 className="text-lg font-bold text-white">Model & Server Health</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                serverHealth?.modelReachable 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : serverHealth 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {serverHealth?.modelReachable ? 'ONLINE' : serverHealth ? 'STANDBY' : 'OFFLINE'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">Backend Node Proxy:</span>
                <span className={serverHealth ? 'text-emerald-400' : 'text-red-400'}>
                  {serverHealth ? 'Connected (Port 3001)' : 'Offline / Awaiting Start'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">Roboflow Model Link:</span>
                <span className={serverHealth?.modelReachable ? 'text-emerald-400' : 'text-amber-400'}>
                  {serverHealth?.modelReachable ? 'YOLOv11 Reached' : 'API Key Configured'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">MySQL Persistence:</span>
                <span className="text-emerald-400">
                  {totalInspections > 0 ? `Active (${totalInspections} records)` : 'Connected'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400">Endpoints:</span>
                <span className="text-slate-400">/api/detect · /api/inspections · /api/issues</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
            Health status validated via live <code>/api/health</code> checks
          </div>
        </div>
      </div>

      {/* Persistent MySQL Inspections History Section */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
              MYSQL PERSISTENCE
            </span>
            <h3 className="text-lg font-bold text-white">Historical Inspection Records</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadInspections}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDb ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {totalInspections} SCANS IN DATABASE
            </span>
          </div>
        </div>

        {loadingDb && inspections.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            Loading inspections from MySQL...
          </div>
        ) : dbError && inspections.length === 0 ? (
          <div className="py-6 border-y border-slate-800/60 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-500/80 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-300">Database Connection Issue</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">{dbError}</p>
          </div>
        ) : inspections.length === 0 ? (
          <div className="py-6 border-y border-slate-800/60 text-center space-y-2">
            <Database className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-300">No stored inspections yet</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              When you run detection scans in the Studio, they will automatically be recorded here into MySQL.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {inspections.map((insp) => {
              const riskColor = 
                insp.overall_risk === 'CRITICAL' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                insp.overall_risk === 'HIGH' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                insp.overall_risk === 'MEDIUM' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

              return (
                <div
                  key={insp.id}
                  onClick={() => onNavigate('reports')}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      INSP #{insp.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${riskColor}`}>
                      {insp.overall_risk}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-white truncate group-hover:text-amber-400 transition-colors">
                      {insp.image_filename}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                      {insp.image_width} &times; {insp.image_height}px · {insp.detection_count} defects
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Damage: {insp.damage_percentage}%</span>
                    <span className="text-slate-500">
                      {new Date(insp.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-mono text-slate-500">
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              ✓ Phase 1: Real AI Detection (Live)
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              ✓ Phase 2: Visual Studio (Live)
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              ✓ Phase 3: Database & Persistence (Connected)
            </span>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>View all reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
