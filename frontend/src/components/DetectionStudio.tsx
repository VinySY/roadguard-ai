import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  FileJson, 
  RotateCcw, 
  Sliders, 
  Layers, 
  Square, 
  Tag, 
  AlertCircle, 
  ShieldCheck, 
  Check, 
  Sparkles,
  Eye,
  Info,
  MapPin,
  Camera
} from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { 
  DetectionResult, 
  DetectionState, 
  PotholeSeverity, 
  SampleImage, 
  AppSettings,
  PotholePrediction
} from '../types/detection';

interface DetectionStudioProps {
  detectionState: DetectionState;
  samples: SampleImage[];
  confidenceSetting: number;
  setConfidenceSetting: (val: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onSelectSample: (sample: SampleImage) => void;
  onDetect: () => void;
  onReset: () => void;
  settings: AppSettings;
}

export const DetectionStudio: React.FC<DetectionStudioProps> = ({
  detectionState,
  samples,
  confidenceSetting,
  setConfidenceSetting,
  onFileSelect,
  onDrop,
  onSelectSample,
  onDetect,
  onReset,
  settings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Camera modal state
  const [showCamera, setShowCamera] = useState<boolean>(false);

  // Overlay visual state
  const [showPolygons, setShowPolygons] = useState<boolean>(settings.showPolygonsByDefault);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(settings.showBoundingBoxesByDefault);
  const [showLabels, setShowLabels] = useState<boolean>(settings.showLabelsByDefault);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isSuccess = detectionState.status === 'success';
  const currentResult: DetectionResult | null = isSuccess ? detectionState.result : null;
  const currentImagePreview: string | null = 
    detectionState.status === 'success' ? detectionState.imagePreview :
    detectionState.status === 'image-selected' ? detectionState.preview :
    detectionState.status === 'detecting' ? detectionState.preview : null;

  // Severity color definitions
  const getSeverityStyle = (severity?: PotholeSeverity, alpha = 1) => {
    switch (severity) {
      case 'critical':
        return {
          stroke: `rgba(239, 68, 68, ${alpha})`, // Red
          fill: `rgba(239, 68, 68, ${alpha * 0.35})`,
          badge: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
      case 'high':
        return {
          stroke: `rgba(249, 115, 22, ${alpha})`, // Orange
          fill: `rgba(249, 115, 22, ${alpha * 0.32})`,
          badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
        };
      case 'moderate':
        return {
          stroke: `rgba(245, 158, 11, ${alpha})`, // Amber
          fill: `rgba(245, 158, 11, ${alpha * 0.3})`,
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        };
      case 'minor':
      default:
        return {
          stroke: `rgba(16, 185, 129, ${alpha})`, // Emerald
          fill: `rgba(16, 185, 129, ${alpha * 0.28})`,
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        };
    }
  };

  const rawPredictions: PotholePrediction[] = currentResult?.predictions || [];

  // Filtered predictions based on active confidence slider and severity tab
  const filteredPredictions = rawPredictions.filter((p) => {
    const meetsConf = (p.confidence * 100) >= confidenceSetting;
    if (!meetsConf) return false;
    if (activeSeverityFilter === 'ALL') return true;
    return (p.severity || 'moderate').toUpperCase() === activeSeverityFilter;
  });

  // Native Canvas Rendering Engine
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentImagePreview || !currentResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentImagePreview;

    img.onload = () => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      // Draw base road image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const modelWidth = currentResult.image?.width || canvas.width;
      const modelHeight = currentResult.image?.height || canvas.height;
      const scaleX = canvas.width / modelWidth;
      const scaleY = canvas.height / modelHeight;

      filteredPredictions.forEach((p, idx) => {
        const isHovered = hoveredIndex === idx;
        const isSelected = selectedIndex === idx;
        const isFocused = isHovered || isSelected;

        const style = getSeverityStyle(p.severity, isFocused ? 1 : 0.85);

        // 1. Render Polygon Segmentation Mask
        if (showPolygons && p.points && p.points.length > 2) {
          ctx.save();
          ctx.beginPath();
          p.points.forEach((pt, i) => {
            const x = pt.x * scaleX;
            const y = pt.y * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();

          ctx.fillStyle = isFocused ? getSeverityStyle(p.severity, 0.55).fill : style.fill;
          ctx.fill();

          ctx.lineWidth = isFocused ? 3.5 : 2;
          ctx.strokeStyle = style.stroke;
          if (isFocused) {
            ctx.shadowColor = style.stroke;
            ctx.shadowBlur = 14;
          }
          ctx.stroke();
          ctx.restore();
        }

        // 2. Render Precision Bounding Box & Corner Brackets
        const boxX = (p.x - p.width / 2) * scaleX;
        const boxY = (p.y - p.height / 2) * scaleY;
        const boxW = p.width * scaleX;
        const boxH = p.height * scaleY;

        if (showBoundingBoxes) {
          ctx.save();
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = isFocused ? 2.5 : 1.5;
          ctx.setLineDash(p.points && showPolygons ? [4, 4] : []);
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Technical corner brackets
          const corner = Math.min(14, boxW / 4, boxH / 4);
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
          ctx.beginPath();
          // Top-Left
          ctx.moveTo(boxX, boxY + corner);
          ctx.lineTo(boxX, boxY);
          ctx.lineTo(boxX + corner, boxY);
          // Top-Right
          ctx.moveTo(boxX + boxW - corner, boxY);
          ctx.lineTo(boxX + boxW, boxY);
          ctx.lineTo(boxX + boxW, boxY + corner);
          // Bottom-Left
          ctx.moveTo(boxX, boxY + boxH - corner);
          ctx.lineTo(boxX, boxY + boxH);
          ctx.lineTo(boxX + corner, boxY + boxH);
          // Bottom-Right
          ctx.moveTo(boxX + boxW - corner, boxY + boxH);
          ctx.lineTo(boxX + boxW, boxY + boxH);
          ctx.lineTo(boxX + boxW, boxY + boxH - corner);
          ctx.stroke();
          ctx.restore();
        }

        // 3. Technical Badges
        if (showLabels) {
          ctx.save();
          const confText = `${(p.confidence * 100).toFixed(0)}%`;
          const label = `#${idx + 1} ${(p.class || 'POTHOLE').toUpperCase()} ${confText}`;
          ctx.font = 'bold 12px "JetBrains Mono", monospace';
          const textMetrics = ctx.measureText(label);
          const padding = 6;
          const labelW = textMetrics.width + padding * 2;
          const labelH = 20;

          let labelX = boxX;
          let labelY = boxY - labelH - 4;
          if (labelY < 0) labelY = boxY + 4;

          ctx.fillStyle = isFocused ? '#090D16' : 'rgba(9, 13, 22, 0.9)';
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.rect(labelX, labelY, labelW, labelH);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isFocused ? '#F59E0B' : '#F8FAFC';
          ctx.fillText(label, labelX + padding, labelY + 14);
          ctx.restore();
        }
      });
    };
  }, [
    currentImagePreview,
    currentResult,
    filteredPredictions,
    showPolygons,
    showBoundingBoxes,
    showLabels,
    hoveredIndex,
    selectedIndex,
  ]);

  useEffect(() => {
    if (isSuccess) {
      renderCanvas();
    }
  }, [isSuccess, renderCanvas]);

  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `roadguard-inspection-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleExportJSON = () => {
    if (!currentResult) return;
    const payload = {
      ...currentResult,
      exportedAt: new Date().toISOString(),
      activeFilterConfidence: confidenceSetting,
      detectedPotholesCount: filteredPredictions.length,
      filteredPredictions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadguard-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Studio Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            Inference Studio
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            AI Pothole Detection & Segmentation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Roboflow YOLOv11 Instance Polygon Inference Workspace
          </p>
        </div>

        {isSuccess && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPNG}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-bold transition-colors"
              title="Download high-resolution image with overlays"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Annotated PNG</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-bold transition-colors"
              title="Export machine-readable JSON data"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Export JSON Report</span>
            </button>

            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-sm shadow-amber-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Inspection</span>
            </button>
          </div>
        )}
      </div>

      {/* Camera capture modal */}
      {showCamera && (
        <CameraCapture
          defaultMode="photo"
          onPhotoCapture={(file, previewUrl) => {
            // Inject captured photo into the existing detection flow
            const preview = previewUrl;
            // setDetectionState is available via parent's onFileSelect pathway;
            // we replicate the same state transition App.tsx does for a file:
            // App.tsx sets status='image-selected' and switches tab to 'detect'.
            // Since DetectionStudio is already active, we call onFileSelect with
            // a synthetic event carrying the File.
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            const syntheticEvent = {
              target: { files: dataTransfer.files },
            } as React.ChangeEvent<HTMLInputElement>;
            onFileSelect(syntheticEvent);
            setShowCamera(false);
            // The preview URL from camera is already a blob URL; App.tsx will
            // create its own via URL.createObjectURL(file) — that is fine and
            // consistent with the file-upload pathway.
          }}
          onVideoCapture={() => {
            // Photo mode only — video camera goes through VideoDetectionStudio
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* IDLE STATE: Upload Dropzone & Sample Gallery */}
      {detectionState.status === 'idle' && (
        <div className="space-y-8">
          {/* Drag & Drop Zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-700/80 hover:border-amber-500/60 bg-slate-900/40 hover:bg-slate-900/70 rounded-2xl p-10 md:p-14 text-center transition-all flex flex-col items-center justify-center gap-4 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Upload className="w-8 h-8 stroke-[1.8]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                Drop Road Surface Imagery Here
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Upload asphalt captures from mobile phones, dashcams, or survey cameras (JPEG, PNG, WebP)
              </p>
            </div>

            {/* Upload + Camera row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <label className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-md shadow-amber-500/20">
                <span>Browse Device Files</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFileSelect}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-amber-500/40 text-slate-200 hover:text-amber-400 font-bold text-xs rounded-xl cursor-pointer transition-all"
                aria-label="Open camera to take a photo"
              >
                <Camera className="w-4 h-4" />
                Use Camera
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 mt-2">
              <span>JPG</span>
              <span>·</span>
              <span>PNG</span>
              <span>·</span>
              <span>WEBP</span>
              <span>·</span>
              <span>Direct /api/detect Transmission</span>
            </div>
          </div>

          {/* Test Dataset Samples */}
          {samples.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Verified Pavement Test Dataset
                  </h4>
                  <p className="text-xs text-slate-400">
                    Select a pre-loaded sample to test YOLOv11 segmentation immediately
                  </p>
                </div>
                <span className="text-[11px] font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                  ROBOFLOW SAMPLES
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => onSelectSample(sample)}
                    className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-800 hover:border-amber-500/60 bg-slate-950 transition-all text-left focus:outline-none"
                  >
                    <img
                      src={`/api/samples/${sample.filename}`}
                      alt={sample.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors block truncate">
                        {sample.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SELECTED IMAGE PREVIEW BEFORE DETECT */}
      {detectionState.status === 'image-selected' && (
        <div className="grid lg:grid-cols-3 gap-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="lg:col-span-2 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-2 min-h-[380px]">
            <img
              src={detectionState.preview}
              alt="Road image preview"
              className="max-h-[460px] w-auto max-w-full object-contain rounded-lg"
            />
          </div>

          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase">
                  Image Staged
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Ready for AI Inspection
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  The image is loaded into memory. Configure sensitivity before dispatching to YOLOv11.
                </p>
              </div>

              {/* Confidence Threshold Slider */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Confidence Threshold</span>
                  <span className="font-mono text-amber-400">{confidenceSetting}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={confidenceSetting}
                  onChange={(e) => setConfidenceSetting(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 leading-snug">
                  Lower sensitivity (15-25%) captures shallow fissures. Higher sensitivity (&gt;50%) isolates high-certainty cavities.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-800">
              <button
                onClick={onDetect}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Run YOLOv11 Segmentation</span>
              </button>

              <button
                onClick={onReset}
                className="w-full py-2 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Choose Another Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETECTING SPINNER STATE */}
      {detectionState.status === 'detecting' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-6">
          <div className="relative w-72 h-44 rounded-xl overflow-hidden border border-amber-500/40 bg-slate-950 shadow-2xl shadow-amber-500/10">
            <img
              src={detectionState.preview}
              alt="Scanning road surface"
              className="w-full h-full object-cover opacity-40 filter contrast-125"
            />
            {/* Animated Laser Scanning Beam */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-[bounce_2s_infinite]" />
          </div>

          <div className="space-y-2 max-w-sm">
            <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
              INFERENCE IN PROGRESS
            </span>
            <h3 className="text-xl font-bold text-white">
              Analyzing Road Image...
            </h3>
            <div className="space-y-1 text-xs text-slate-400">
              <p>Detecting pavement damage</p>
              <p>Extracting YOLOv11 polygon instance segmentation</p>
              <p>Calculating surface area & risk metrics</p>
            </div>
          </div>
        </div>
      )}

      {/* NO DETECTIONS ZERO STATE */}
      {detectionState.status === 'no-detections' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              No Potholes Detected
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              The model did not find any surface potholes above the current {confidenceSetting}% confidence threshold.
            </p>
          </div>

          <div className="max-w-xs rounded-xl overflow-hidden border border-slate-800 my-2">
            <img src={detectionState.imagePreview} alt="Inspected surface" className="w-full h-32 object-cover" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setConfidenceSetting(15);
                onDetect();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors"
            >
              Retry with Lower Threshold (15%)
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
            >
              Test Another Image
            </button>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {detectionState.status === 'error' && (
        <div className="bg-slate-900/60 border border-red-500/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              Detection Unavailable
            </h3>
            <p className="text-xs text-red-300 max-w-lg mx-auto font-mono">
              {detectionState.error}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
              RoadGuard could not reach the AI detection service. Check that the backend is running on port 3001 and try again.
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={onDetect}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm shadow-amber-500/20"
            >
              Retry Detection
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Back to Upload
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS STATE: Canvas Viewport & Inventory Workspace */}
      {isSuccess && currentResult && (
        <div className="space-y-6">
          {/* Real Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Total Potholes</span>
              <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
                {filteredPredictions.length}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                At &ge; {confidenceSetting}% confidence
              </span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Assessed Risk</span>
              <div className={`text-2xl font-black mt-1 font-mono ${
                currentResult.analytics?.overallRiskLevel === 'CRITICAL' ? 'text-red-400' :
                currentResult.analytics?.overallRiskLevel === 'HIGH' ? 'text-orange-400' :
                currentResult.analytics?.overallRiskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {currentResult.analytics?.overallRiskLevel || (filteredPredictions.length > 2 ? 'HIGH' : filteredPredictions.length > 0 ? 'MEDIUM' : 'LOW')}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Structural rating</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Peak Confidence</span>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {filteredPredictions.length > 0
                  ? `${(Math.max(...filteredPredictions.map(p => p.confidence)) * 100).toFixed(0)}%`
                  : '0%'}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Model certainty</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Inference Time</span>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {currentResult.time ? `${(currentResult.time * 1000).toFixed(0)}ms` : '<40ms'}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Roboflow hosted latency</span>
            </div>
          </div>

          {/* EXIF GPS Telemetry if present */}
          {currentResult.location && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl text-xs">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono text-amber-300 font-bold uppercase text-[11px]">
                  EXIF GPS Detected:
                </span>
                <span className="font-mono text-slate-200">
                  {currentResult.location.latitude.toFixed(6)}°, {currentResult.location.longitude.toFixed(6)}°
                </span>
                <span className="text-[11px] text-amber-400/80 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  Auto-Geotagged for Road Map
                </span>
              </div>
            </div>
          )}

          {/* Interactive Workspace Split */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Canvas Viewport (2 cols) */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showPolygons}
                      onChange={(e) => setShowPolygons(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    <span>Polygons</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showBoundingBoxes}
                      onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    <span>Bounding Boxes</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    <span>Labels</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400">Sensitivity:</span>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={confidenceSetting}
                    onChange={(e) => setConfidenceSetting(parseInt(e.target.value, 10))}
                    className="w-24 accent-amber-500"
                  />
                  <span className="text-amber-400 font-bold">{confidenceSetting}%</span>
                </div>
              </div>

              {/* Canvas Container */}
              <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center min-h-[380px]">
                <canvas ref={canvasRef} className="max-w-full h-auto block rounded-lg shadow-2xl" />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Hover or click inventory items to highlight corresponding polygons</span>
                <span>Canvas Res: {currentResult.image.width} &times; {currentResult.image.height}px</span>
              </div>
            </div>

            {/* Pothole Inventory List (1 col) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Detection Inventory</span>
                    <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {filteredPredictions.length}
                    </span>
                  </h3>
                </div>

                {/* Severity Filter Tabs */}
                <div className="flex gap-1 p-1 bg-slate-950 rounded-lg text-[10px] font-mono">
                  {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'MINOR'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setActiveSeverityFilter(sev)}
                      className={`flex-1 py-1 rounded font-bold transition-colors ${
                        activeSeverityFilter === sev
                          ? 'bg-slate-800 text-amber-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                {/* Scrollable Items */}
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {filteredPredictions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No potholes match the selected filter.
                    </div>
                  ) : (
                    filteredPredictions.map((p, idx) => {
                      const isHovered = hoveredIndex === idx;
                      const isSelected = selectedIndex === idx;
                      const sev = (p.severity || 'moderate').toLowerCase() as PotholeSeverity;
                      const style = getSeverityStyle(sev);

                      return (
                        <div
                          key={p.id || idx}
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => setSelectedIndex(isSelected ? null : idx)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                              : isHovered
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-950/70 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-white font-mono">
                              #{idx + 1} {p.class || 'Pothole'}
                            </span>
                            <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${style.badge}`}>
                              {sev}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                            <div>
                              <span className="text-slate-500">Confidence: </span>
                              <span className="text-slate-200 font-semibold">
                                {(p.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Center: </span>
                              <span className="text-slate-200">
                                ({Math.round(p.x)}, {Math.round(p.y)})
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Box: </span>
                              <span className="text-slate-200">
                                {Math.round(p.width)}&times;{Math.round(p.height)}px
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Polygon: </span>
                              <span className="text-slate-200">
                                {p.points ? `${p.points.length} pts` : 'BBox'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Model: YOLOv11 Seg</span>
                <span>Active Layer: Mask+Box</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
