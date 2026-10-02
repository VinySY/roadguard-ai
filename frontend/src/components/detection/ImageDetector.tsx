import React, { useState, useRef } from 'react';
import { detectPotholesInImage } from '../../services/detection';
import { DetectionResult, UserRole } from '../../types';
import { UploadCloud, CheckCircle2, AlertTriangle, Eye, ChevronDown, ChevronUp, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface ImageDetectorProps {
  onDetectionComplete?: (result: DetectionResult) => void;
  role?: UserRole;
  initialImage?: string;
  onProceedToReport?: (result: DetectionResult) => void;
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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setDetectionResult(null);
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
      setDetectionResult(null);
      setErrorMsg(null);
    }
  };

  const runDetection = async (sourceImage?: string) => {
    const target = sourceImage || selectedFile || imagePreview;
    if (!target) return;

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const result = await detectPotholesInImage(target);
      setDetectionResult(result);
      if (onDetectionComplete) {
        onDetectionComplete(result);
      }
    } catch (err: any) {
      console.error('Detection failed', err);
      setErrorMsg('Detection analysis could not be completed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSamplePavement = () => {
    const sample = '/src/assets/images/roadguard_pothole_evidence_1790958622590.jpg';
    setImagePreview(sample);
    setSelectedFile(null);
    setDetectionResult(null);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Dropzone if no image is loaded */}
      {!imagePreview ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-amber-500/70 rounded-2xl p-8 text-center bg-slate-900/50 hover:bg-slate-900/80 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[240px]"
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm"
            >
              Browse Files
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                loadSamplePavement();
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
            >
              Try Pavement Sample
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        /* Image Preview & Detection Visualization */
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            {/* The Image */}
            <img
              src={imagePreview}
              alt="Road Inspection Subject"
              className="w-full max-h-[440px] object-contain block"
            />

            {/* Bounding Box Canvas Overlay if detected */}
            {detectionResult && detectionResult.boxes.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {detectionResult.boxes.map((box, index) => {
                  const left = `${box.x * 100}%`;
                  const top = `${box.y * 100}%`;
                  const width = `${box.width * 100}%`;
                  const height = `${box.height * 100}%`;

                  return (
                    <div
                      key={index}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width,
                        height,
                      }}
                      className="border-2 border-amber-400 bg-amber-400/10 rounded shadow-sm"
                    >
                      <span className="absolute -top-5 left-0 bg-amber-500 text-slate-950 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                        {box.class} {Math.round(box.confidence * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scanning / Analysis Animation Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-100 p-6 z-20">
                <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping"></div>
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
                <h5 className="text-sm font-semibold mb-1">Analyzing Road Surface...</h5>
                <p className="text-xs text-slate-400 max-w-xs text-center font-mono">
                  Scanning asphalt distress, fissure margins, and depth contours.
                </p>
                {/* Horizontal scan line animation */}
                <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mt-4 animate-pulse"></div>
              </div>
            )}
          </div>

          {/* Action row right under image */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setSelectedFile(null);
                  setDetectionResult(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline font-medium"
              >
                Change Image
              </button>
            </div>

            {!detectionResult ? (
              <button
                onClick={() => runDetection()}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isAnalyzing ? 'Analyzing...' : 'Run RoadGuard Detection'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runDetection()}
                  disabled={isAnalyzing}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Re-analyze
                </button>
                {onProceedToReport && (
                  <button
                    onClick={() => onProceedToReport(detectionResult)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    <span>Proceed with Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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

          {/* Clean Detection Summary Card (Anti-Slop, No Hallucinated Scoreboards) */}
          {detectionResult && (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
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
                      {detectionResult.potholeCount}
                    </span>{' '}
                    {detectionResult.potholeCount === 1 ? 'pothole' : 'potholes'}.
                  </h4>
                </div>
                <div className="text-xs text-slate-400">
                  Severity:{' '}
                  <span
                    className={`font-semibold capitalize ${
                      detectionResult.severity === 'critical'
                        ? 'text-rose-400'
                        : detectionResult.severity === 'high'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {detectionResult.severity}
                  </span>
                </div>
              </div>

              {/* Useful Actionable Findings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Municipal Recommendation</span>
                  <span className="text-slate-200 font-medium">
                    {detectionResult.recommendedAction || 'Schedule for road inspection'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Pavement Surface Quality</span>
                  <span className="text-slate-200 font-mono tabular-nums">
                    Index {detectionResult.roadConditionIndex || 50}/100
                  </span>
                </div>
              </div>

              {/* Progressive Disclosure: Technical Details (Only for staff / curious user, collapsed by default) */}
              {(role === 'worker' || role === 'inspector') && (
                <div className="pt-2">
                  <button
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
                        <span>Confidence Level:</span>
                        <span className="text-slate-200 tabular-nums">
                          {Math.round(detectionResult.confidence * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bounding Boxes Identified:</span>
                        <span className="text-slate-200 tabular-nums">
                          {detectionResult.boxes.length} regions
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
