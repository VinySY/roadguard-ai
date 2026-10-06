import React, { useState, useRef, useEffect } from 'react';
import { DetectionResult, UserRole } from '../../types';
import { detectPotholesInVideo } from '../../services/detection';
import { UploadCloud, Play, Pause, AlertTriangle, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface VideoDetectorProps {
  onDetectionComplete?: (result: DetectionResult) => void;
  role?: UserRole;
  onProceedToReport?: (result: DetectionResult) => void;
  onViewOnMap?: () => void;
  initialVideo?: { blob?: Blob; url: string } | null;
}

export const VideoDetector: React.FC<VideoDetectorProps> = ({
  onDetectionComplete,
  role = 'citizen',
  onProceedToReport,
  onViewOnMap,
  initialVideo,
}) => {
  const [videoFile, setVideoFile] = useState<File | Blob | null>(initialVideo?.blob || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideo?.url || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [videoResult, setVideoResult] = useState<DetectionResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialVideo?.url) {
      setVideoUrl(initialVideo.url);
      setVideoFile(initialVideo.blob || null);
      setVideoResult(null);
      setProgressPercent(0);
    }
  }, [initialVideo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setErrorMessage('Please select a valid video file (MP4, WebM, MOV).');
        return;
      }
      setErrorMessage(null);
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoResult(null);
      setProgressPercent(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setErrorMessage('Please drop a valid video file.');
        return;
      }
      setErrorMessage(null);
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoResult(null);
      setProgressPercent(0);
    }
  };

  const handleStartAnalysis = async () => {
    const target = videoFile || videoUrl;
    if (!target) return;

    setIsProcessing(true);
    setProgressPercent(15);
    setErrorMessage(null);

    const progressTimer = setInterval(() => {
      setProgressPercent((prev) => (prev >= 85 ? 85 : prev + 12));
    }, 300);

    try {
      const result = await detectPotholesInVideo(target);
      clearInterval(progressTimer);
      setProgressPercent(100);
      setVideoResult(result);
      if (onDetectionComplete) {
        onDetectionComplete(result);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error('Video analysis failed', err);
      setErrorMessage('Video detection analysis could not be completed. Please try another video file.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {!videoUrl ? (
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
            Upload Dashcam / Road Video for Inspection
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            Drag and drop road video, or click to browse. Supports MP4, WebM, and MOV up to 100MB.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm"
          >
            Select Video File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Large Playable Video Area */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls
              playsInline
            />

            {/* Analysis Progress Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-slate-100 p-6 z-20">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                <h5 className="text-sm font-semibold mb-1">Processing Video Stream...</h5>
                <p className="text-xs text-slate-400 mb-4 font-mono">
                  Analyzing frames for roadway surface cavities & cracking
                </p>
                <div className="w-64 bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <span className="text-[11px] font-mono text-amber-400 mt-2">
                  {progressPercent}% Complete
                </span>
              </div>
            )}
          </div>

          {/* Video Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setVideoUrl(null);
                setVideoFile(null);
                setVideoResult(null);
                setErrorMessage(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 underline font-medium"
            >
              Choose Different Video
            </button>

            {!videoResult ? (
              <button
                onClick={handleStartAnalysis}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing ? 'Analyzing Frames...' : 'Analyze Video with RoadGuard AI'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartAnalysis}
                  disabled={isProcessing}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Re-analyze
                </button>
                {onViewOnMap && (
                  <button
                    onClick={onViewOnMap}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg"
                  >
                    View on Map
                  </button>
                )}
                {onProceedToReport && (
                  <button
                    onClick={() => onProceedToReport(videoResult)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm"
                  >
                    <span>Create Municipal Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Video Detection Result Summary */}
          {videoResult && (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-slate-100">
                    Video Analysis Complete: RoadGuard detected{' '}
                    <span className="text-amber-400 font-mono tabular-nums">
                      {videoResult.potholeCount}
                    </span>{' '}
                    roadway issues.
                  </h4>
                </div>
                <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                  Highest Severity: {videoResult.severity}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Average Confidence</span>
                  <span className="text-slate-200 font-mono tabular-nums">
                    {Math.round(videoResult.confidence * 100)}%
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Potholes Identified</span>
                  <span className="text-amber-400 font-mono font-semibold tabular-nums">
                    {videoResult.potholeCount} cavities
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Pavement Integrity</span>
                  <span className="text-slate-200 font-mono tabular-nums">
                    Index {videoResult.roadConditionIndex || 48}/100
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
