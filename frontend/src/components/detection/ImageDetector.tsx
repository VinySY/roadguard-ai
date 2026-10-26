import React, { useState, useRef, useEffect } from 'react';
import { detectPotholesInImage } from '../../services/detection';
import { DetectionResult, UserRole, BoundingBox } from '../../types';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Loader2,
  Sparkles,
  Sliders,
  Image as ImageIcon,
} from 'lucide-react';
import { getApiUrl } from '../../config/api';
import potholeSample from '../../assets/images/roadguard_pothole_evidence_1790958622590.jpg';

interface ImageDetectorProps {
  onDetectionComplete?: (result: DetectionResult) => void;
  role?: UserRole;
  initialImage?: string;
  onProceedToReport?: (result: DetectionResult) => void;
}

interface SampleOption {
  id: string;
  name: string;
  filename: string;
  url: string;
}

export const ImageDetector: React.FC<ImageDetectorProps> = ({
  onDetectionComplete,
  role = 'citizen',
  initialImage,
  onProceedToReport,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<number>(20);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sampleList, setSampleList] = useState<SampleOption[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialImage prop changes
  useEffect(() => {
    if (initialImage) {
      setImagePreview(initialImage);
      setSelectedFile(null);
      setDetectionResult(null);
      setErrorMsg(null);
    }
  }, [initialImage]);

  // Load sample image list from backend /api/samples
  useEffect(() => {
    let isMounted = true;
    const loadSamples = async () => {
      try {
        const res = await fetch(getApiUrl('/api/samples'));
        if (res.ok) {
          const data = await res.json();
          const list: any[] = data.samples || (Array.isArray(data) ? data : []);
          if (isMounted && list.length > 0) {
            setSampleList(
              list.slice(0, 4).map((s: any, idx: number) => ({
                id: s.id || `sample-${idx + 1}`,
                name: s.name || `Sample ${idx + 1}`,
                filename: s.filename,
                url: getApiUrl(`/api/samples/${s.filename}`),
              }))
            );
          }
        }
      } catch {
        // Fallback default samples if offline
      }
    };
    loadSamples();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setDetectionResult(null); // Clear previous image detections immediately
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setDetectionResult(null); // Clear previous image detections immediately
      setErrorMsg(null);
    }
  };

  const handleSelectSample = (sampleUrl: string, sampleFilename?: string) => {
    setImagePreview(sampleUrl);
    setSelectedFile(null);
    setDetectionResult(null); // Clear previous image detections immediately
    setErrorMsg(null);
  };

  const runDetection = async (sourceImage?: string) => {
    const target = sourceImage || selectedFile || imagePreview;
    if (!target) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    setDetectionResult(null); // Ensure fresh detection state

    try {
      const result = await detectPotholesInImage(target, {
        confidenceThreshold: confidenceFilter,
      });
      setDetectionResult(result);
      if (onDetectionComplete) {
        onDetectionComplete(result);
      }
    } catch (err: any) {
      console.error('Detection failed', err);
      setErrorMsg(err.message || 'Detection analysis could not be completed. Please ensure backend is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter boxes according to active confidence threshold
  const visibleBoxes: BoundingBox[] = (detectionResult?.boxes || []).filter(
    (b) => Math.round(b.confidence * 100) >= confidenceFilter
  );

  const displayedCount = visibleBoxes.length;

  return (
    <div className="space-y-4">
      {/* Upload Dropzone if no image is loaded */}
      {!imagePreview ? (
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a road photo for AI analysis"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 p-8 text-center transition-colors hover:border-amber-500/70 hover:bg-slate-900/80"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-100 mb-1">
              Upload Road Photo for AI Analysis
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Drag and drop road surface photo, or click to browse. Supports JPG, PNG, WebP up to 25MB.
            </p>
            <span className="rg-btn rg-btn-primary">Browse files</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Choose a road photo"
            />
          </div>

          {/* Quick Real Test Samples from Dataset */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>Or test with dataset sample images:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sampleList.length > 0 ? (
                sampleList.map((sample, idx) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample.url, sample.filename)}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-left transition-colors flex items-center gap-2"
                  >
                    <div className="w-8 h-8 rounded bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-700">
                      <img src={sample.url} alt={sample.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] text-slate-200 font-medium truncate">
                      Sample #{idx + 1}
                    </span>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectSample(potholeSample)}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-left transition-colors hover:bg-slate-700/80"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950">
                    <img src={potholeSample} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="text-[11px] font-medium text-slate-200">Pavement evidence sample</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview & Detection Visualization */
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-2 sm:p-4 flex items-center justify-center min-h-[300px]">
            {/* Tightly-wrapped container that exactly matches the rendered image dimensions */}
            <div className="relative inline-block max-w-full">
              <img
                src={imagePreview}
                alt="Road Inspection Subject"
                className="max-h-[460px] max-w-full w-auto h-auto block rounded-xl mx-auto shadow-md"
              />

              {/* Bounding Box & Polygon Overlay (Strictly attached to the exact image canvas) */}
              {detectionResult && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                  {/* SVG Instance Segmentation Polygon Masks */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${detectionResult.image?.width || 640} ${detectionResult.image?.height || 640}`}
                    preserveAspectRatio="none"
                  >
                    {visibleBoxes.map((box, index) => {
                      if (!box.points || box.points.length < 3) return null;
                      const pointsStr = box.points.map((pt) => `${pt.x},${pt.y}`).join(' ');
                      const strokeColor =
                        box.severity === 'critical'
                          ? '#EF4444'
                          : box.severity === 'high'
                          ? '#F97316'
                          : '#F59E0B';
                      const fillColor =
                        box.severity === 'critical'
                          ? 'rgba(239, 68, 68, 0.30)'
                          : box.severity === 'high'
                          ? 'rgba(249, 115, 22, 0.26)'
                          : 'rgba(245, 158, 11, 0.25)';

                      return (
                        <polygon
                          key={`poly-${box.id || index}`}
                          points={pointsStr}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                        />
                      );
                    })}
                  </svg>

                  {/* High-Precision Bounding Boxes & Corner Brackets */}
                  {visibleBoxes.map((box, index) => {
                    const left = `${box.x * 100}%`;
                    const top = `${box.y * 100}%`;
                    const width = `${box.width * 100}%`;
                    const height = `${box.height * 100}%`;

                    const colorTheme =
                      box.severity === 'critical'
                        ? {
                            border: 'border-rose-500',
                            bg: 'bg-rose-500/15',
                            badge: 'bg-rose-600 text-white',
                            corner: 'border-rose-400',
                          }
                        : box.severity === 'high'
                        ? {
                            border: 'border-orange-500',
                            bg: 'bg-orange-500/15',
                            badge: 'bg-orange-600 text-white',
                            corner: 'border-orange-400',
                          }
                        : {
                            border: 'border-amber-400',
                            bg: 'bg-amber-400/15',
                            badge: 'bg-amber-500 text-slate-950',
                            corner: 'border-amber-300',
                          };

                    return (
                      <div
                        key={`box-${box.id || index}`}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width,
                          height,
                        }}
                        className={`border-2 ${colorTheme.border} ${colorTheme.bg} rounded shadow-sm`}
                      >
                        {/* Technical corner brackets */}
                        <span className={`absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 ${colorTheme.corner}`} />
                        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 ${colorTheme.corner}`} />
                        <span className={`absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 ${colorTheme.corner}`} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 ${colorTheme.corner}`} />

                        {/* Technical Class & Confidence Tag */}
                        <div
                          className={`absolute -top-5 left-0 ${colorTheme.badge} text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 flex items-center gap-1`}
                        >
                          <span>#{index + 1}</span>
                          <span>{box.class}</span>
                          <span>{Math.round(box.confidence * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scanning / Analysis Animation Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-100 p-6 z-20">
                <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping"></div>
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
                <h5 className="text-sm font-semibold mb-1">Analyzing Road Surface with Roboflow...</h5>
                <p className="text-xs text-slate-400 max-w-xs text-center font-mono">
                  Executing YOLOv11 segmentation inference & extracting cavity coordinates.
                </p>
                {/* Horizontal scan line animation */}
                <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mt-4 animate-pulse"></div>
              </div>
            )}
          </div>

          {/* Action row right under image */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setSelectedFile(null);
                  setDetectionResult(null);
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline font-medium"
              >
                Change Image
              </button>

              {/* Confidence Threshold Slider */}
              <div className="flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-400">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Confidence:</span>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(parseInt(e.target.value, 10))}
                  className="h-1.5 w-20 cursor-pointer rounded-lg bg-slate-800 accent-amber-500 sm:w-24"
                  aria-label="Minimum detection confidence"
                />
                <span className="font-mono text-slate-200 text-[11px] tabular-nums">
                  {confidenceFilter}%
                </span>
              </div>
            </div>

            {!detectionResult ? (
              <button
                type="button"
                onClick={() => runDetection()}
                disabled={isAnalyzing}
                className="rg-btn rg-btn-primary"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isAnalyzing ? 'Analyzing…' : 'Run RoadGuard detection'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runDetection()}
                  disabled={isAnalyzing}
                  className="rg-btn rg-btn-secondary rg-btn-sm"
                >
                  Re-analyze
                </button>
                {onProceedToReport && (
                  <button
                    type="button"
                    onClick={() =>
                      onProceedToReport({
                        ...detectionResult,
                        boxes: visibleBoxes,
                        potholeCount: displayedCount,
                      })
                    }
                    className="rg-btn rg-btn-primary rg-btn-sm"
                  >
                    <span>Proceed with report</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Detection Summary Card */}
          {detectionResult && (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {displayedCount > 0 ? (
                    <>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          detectionResult.severity === 'critical'
                            ? 'bg-rose-500'
                            : detectionResult.severity === 'high'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      ></div>
                      <h4 className="text-sm font-semibold text-slate-100">
                        RoadGuard detected{' '}
                        <span className="text-amber-400 font-mono tabular-nums">
                          {displayedCount}
                        </span>{' '}
                        unique {displayedCount === 1 ? 'pothole' : 'potholes'}.
                      </h4>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-emerald-400">
                        No Potholes Detected — Pavement Surface Clear
                      </h4>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Severity:{' '}
                  <span
                    className={`font-semibold capitalize ${
                      displayedCount === 0
                        ? 'text-emerald-400'
                        : detectionResult.severity === 'critical'
                        ? 'text-rose-400'
                        : detectionResult.severity === 'high'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {displayedCount === 0 ? 'Clear' : detectionResult.severity}
                  </span>
                </div>
              </div>

              {/* Actionable Findings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Municipal Recommendation</span>
                  <span className="text-slate-200 font-medium">
                    {displayedCount === 0
                      ? 'No road surface repairs required at this location.'
                      : detectionResult.recommendedAction || 'Schedule for road inspection'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Pavement Surface Quality</span>
                  <span className="text-slate-200 font-mono tabular-nums">
                    {displayedCount === 0
                      ? 'No defects detected'
                      : `Index ${detectionResult.roadConditionIndex ?? '—'}/100`}
                  </span>
                </div>
              </div>

              {(detectionResult.warnings?.length || detectionResult.limitations?.length) ? (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  {detectionResult.warnings?.map((warning, idx) => (
                    <p key={`warning-${idx}`} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                      <span>{warning}</span>
                    </p>
                  ))}
                  {detectionResult.limitations?.map((limitation, idx) => (
                    <p key={`limitation-${idx}`} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-slate-500" />
                      <span>{limitation}</span>
                    </p>
                  ))}
                </div>
              ) : null}

              {/* Technical Detection Parameters */}
              {(role === 'worker' || role === 'inspector' || showTechnicalDetails) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
                  >
                    <span>{showTechnicalDetails ? 'Hide' : 'View'} Technical Detection Parameters</span>
                    {showTechnicalDetails ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showTechnicalDetails && (
                    <div className="mt-2.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Model Pipeline:</span>
                        <span className="text-slate-200">Roboflow YOLOv11 Instance Segmentation</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Original Image Resolution:</span>
                        <span className="text-slate-200 tabular-nums">
                          {detectionResult.image?.width || 640} × {detectionResult.image?.height || 640} px
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unique Potholes:</span>
                        <span className="text-slate-200 tabular-nums">
                          {displayedCount} shown of {detectionResult.boxes.length} identified
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Raw Model Predictions:</span>
                        <span className="text-slate-200 tabular-nums">
                          {detectionResult.analytics?.rawDetectionCount ?? detectionResult.boxes.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duplicates Merged:</span>
                        <span className="text-slate-200 tabular-nums">
                          {detectionResult.analytics?.duplicatePredictionsRemoved ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mean Detection Confidence:</span>
                        <span className="text-slate-200 tabular-nums">
                          {Math.round(detectionResult.confidence * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Analysis Timestamp:</span>
                        <span className="text-slate-200">
                          {new Date(detectionResult.processedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
