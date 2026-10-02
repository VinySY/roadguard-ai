import React from 'react';
import { 
  Sliders, 
  Layers, 
  Server, 
  RefreshCw, 
  Info, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { AppSettings, ServerHealth } from '../types/detection';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  serverHealth: ServerHealth | null;
  onPingHealth: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  serverHealth,
  onPingHealth,
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="pb-4 border-b border-slate-800">
        <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
          PREFERENCES & DIAGNOSTICS
        </span>
        <h2 className="text-2xl font-black text-white tracking-tight">
          System & Detection Settings
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure default overlay behaviors, sensitivity thresholds, and check backend status
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Detection Preferences Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Detection Overlay Defaults</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="space-y-0.5">
                <span className="font-semibold text-white block">Render Polygon Masks by Default</span>
                <span className="text-slate-400 block">Show YOLOv11 segmentation mask fills</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showPolygonsByDefault}
                onChange={(e) => onUpdateSettings({ ...settings, showPolygonsByDefault: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="space-y-0.5">
                <span className="font-semibold text-white block">Render Precision Bounding Boxes</span>
                <span className="text-slate-400 block">Show boundary outlines & corner brackets</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showBoundingBoxesByDefault}
                onChange={(e) => onUpdateSettings({ ...settings, showBoundingBoxesByDefault: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="space-y-0.5">
                <span className="font-semibold text-white block">Render Defect Information Badges</span>
                <span className="text-slate-400 block">Show class label and confidence tags</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showLabelsByDefault}
                onChange={(e) => onUpdateSettings({ ...settings, showLabelsByDefault: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="font-semibold text-white">Default Sensitivity Threshold</span>
                <span className="text-amber-400 font-bold">{settings.defaultConfidence}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={settings.defaultConfidence}
                onChange={(e) => onUpdateSettings({ ...settings, defaultConfidence: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block">
                Applied as baseline confidence threshold for newly uploaded images
              </span>
            </div>
          </div>
        </div>

        {/* Backend & AI Model Diagnostics */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Backend Connection Status</h3>
            </div>
            <button
              onClick={onPingHealth}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Re-verify /api/health"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between">
              <span className="text-slate-400">Backend Server URL:</span>
              <span className="text-slate-200">http://localhost:3001/api</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between">
              <span className="text-slate-400">Server Health Status:</span>
              <span className={serverHealth ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {serverHealth ? 'ONLINE (200 OK)' : 'OFFLINE / UNREACHABLE'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between">
              <span className="text-slate-400">Roboflow Model Link:</span>
              <span className={serverHealth?.modelReachable ? 'text-emerald-400' : 'text-amber-400'}>
                {serverHealth?.modelReachable ? 'YOLOv11 Instance Seg Active' : 'Checking API Key...'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between">
              <span className="text-slate-400">Project / Workspace:</span>
              <span className="text-slate-200 truncate max-w-[200px]">
                {serverHealth?.model?.project || 'pothole-segmentation'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Info className="w-4 h-4 text-amber-400" />
              <span>About RoadGuard AI</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              RoadGuard AI combines high-resolution road photography with hosted Roboflow YOLOv11 instance segmentation. Built for public works departments, roadway inspectors, and citizens advocating for safer streets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
