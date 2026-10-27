import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DetectionResult, UserRole, BoundingBox, VideoFrameDetection } from '../../types';
import { detectPotholesInVideo } from '../../services/detection';
import {
  UploadCloud,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  Film,
  Layers,
} from 'lucide-react';

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
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
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
    setVideoResult(null);

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
      setErrorMessage(err.message || 'Video detection analysis could not be completed. Please try another video file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Synchronize bounding boxes with current video playback timestamp
  const getActiveFrameBoxes = useCallback((): BoundingBox[] => {
    if (!videoResult) return [];

    const frames = videoResult.videoFrames || [];
    if (frames.length === 0) {
      return videoResult.boxes || [];
    }

    // Find the closest frame within tolerance window (0.8s)
    let closestFrame: VideoFrameDetection | null = null;
    let minDiff = Infinity;

    for (const f of frames) {
      const diff = Math.abs(f.timestamp - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = f;
      }
    }

    if (closestFrame && minDiff <= 1.2 && closestFrame.boxes.length > 0) {
      return closestFrame.boxes;
    }

    // Fallback to primary detected boxes if video is paused or near beginning
    if (videoResult.boxes && videoResult.boxes.length > 0) {
      return videoResult.boxes;
    }

    return [];
  }, [videoResult, currentTime]);

  const activeBoxes = getActiveFrameBoxes();
  const framesWithDetections = (videoResult?.videoFrames || []).filter((f) => f.boxes.length > 0);

  const handleJumpToTimestamp = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="space-y-4">
      {!videoUrl ? (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a road video for inspection"
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
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <UploadCloud className="h-7 w-7" aria-hidden="true" />
            </div>
            <h4 className="mb-1 text-base font-semibold text-slate-100">
              Upload dashcam or road video for inspection
            </h4>
            <p className="mb-4 max-w-sm text-xs text-slate-400">
              Drag and drop road video, or click to browse. Supports MP4, WebM, and MOV up to 100MB.
            </p>
            <span className="rg-btn rg-btn-primary">Select video file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Choose a road video"
            />
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Large Playable Video Area with Real-Time Bounding Box Overlay */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-2 sm:p-4 flex items-center justify-center min-h-[320px]">
            <div className="relative inline-block max-w-full">
              <video
                ref={videoRef}
                src={videoUrl}
                className="max-h-[460px] max-w-full w-auto h-auto block rounded-xl mx-auto shadow-md"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                onSeeked={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                controls
                playsInline
              />

              {/* Dynamic Video Overlay with Pothole Bounding Boxes */}
              {videoResult && showOverlays && activeBoxes.length > 0 && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                  {/* SVG Instance Segmentation Polygon Masks */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${videoResult.image?.width || 640} ${videoResult.image?.height || 360}`}
                    preserveAspectRatio="none"
                  >
                    {activeBoxes.map((box, index) => {
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
                          ? 'rgba(239, 68, 68, 0.32)'
                          : box.severity === 'high'
                          ? 'rgba(249, 115, 22, 0.28)'
                          : 'rgba(245, 158, 11, 0.25)';

                      return (
                        <polygon
                          key={`v-poly-${box.id || index}`}
                          points={pointsStr}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                        />
                      );
                    })}
                  </svg>

                  {/* Bounding Boxes */}
                  {activeBoxes.map((box, index) => {
                    const left = `${box.x * 100}%`;
                    const top = `${box.y * 100}%`;
                    const width = `${box.width * 100}%`;
                    const height = `${box.height * 100}%`;

                    const colorTheme =
                      box.severity === 'critical'
                        ? {
                            border: 'border-rose-500',
                            bg: 'bg-rose-500/20',
                            badge: 'bg-rose-600 text-white',
                            corner: 'border-rose-400',
                          }
                        : box.severity === 'high'
                        ? {
                            border: 'border-orange-500',
                            bg: 'bg-orange-500/20',
                            badge: 'bg-orange-600 text-white',
                            corner: 'border-orange-400',
                          }
                        : {
                            border: 'border-amber-400',
                            bg: 'bg-amber-400/20',
                            badge: 'bg-amber-500 text-slate-950',
                            corner: 'border-amber-300',
                          };

                    return (
                      <div
                        key={`v-box-${box.id || index}`}
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

                        {/* Label Badge */}
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

            {/* Analysis Progress Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-slate-100 p-6 z-20">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                <h5 className="text-sm font-semibold mb-1">Processing Video Stream with Roboflow...</h5>
                <p className="text-xs text-slate-400 mb-4 font-mono">
                  Extracting transit frames, tracking defects, and aggregating road cavity positions
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setVideoUrl(null);
                  setVideoFile(null);
                  setVideoResult(null);
                  setErrorMessage(null);
                }}
                className="text-xs font-medium text-slate-400 underline hover:text-slate-200"
              >
                Choose different video
              </button>

              {videoResult && (
                <button
                  type="button"
                  onClick={() => setShowOverlays(!showOverlays)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                    showOverlays
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{showOverlays ? 'Hide Box Overlay' : 'Show Box Overlay'}</span>
                </button>
              )}
            </div>

            {!videoResult ? (
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isProcessing}
                className="rg-btn rg-btn-primary"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isProcessing ? 'Analyzing frames…' : 'Analyze video with RoadGuard AI'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isProcessing}
                  className="rg-btn rg-btn-secondary rg-btn-sm"
                >
                  Re-analyze
                </button>
                {onViewOnMap && (
                  <button type="button" onClick={onViewOnMap} className="rg-btn rg-btn-secondary rg-btn-sm">
                    View on map
                  </button>
                )}
                {onProceedToReport && (
                  <button
                    type="button"
                    onClick={() => onProceedToReport(videoResult)}
                    className="rg-btn rg-btn-primary rg-btn-sm"
                  >
                    <span>Create municipal report</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Keyframe Timeline Markers (Jump to detected defects) */}
          {videoResult && framesWithDetections.length > 0 && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <span>Jump to Detected Defects Along Transit Stream:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {framesWithDetections.map((f, idx) => (
                  <button
                    key={`kf-${f.frameIndex}-${idx}`}
                    type="button"
                    onClick={() => handleJumpToTimestamp(f.timestamp)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-lg text-left text-[11px] font-mono text-slate-200 transition-colors flex items-center gap-2"
                  >
                    <span className="text-amber-400">@{f.timestamp.toFixed(1)}s</span>
                    <span className="text-slate-400">
                      ({f.boxes.length} {f.boxes.length === 1 ? 'box' : 'boxes'})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                    Video Analysis Complete: RoadGuard identified{' '}
                    <span className="text-amber-400 font-mono tabular-nums">
                      {videoResult.potholeCount}
                    </span>{' '}
                    unique roadway {videoResult.potholeCount === 1 ? 'pothole' : 'potholes'}.
                  </h4>
                </div>
                <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                  Highest Severity: {videoResult.severity}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Corridor Risk</span>
                  <span className="text-slate-200 font-medium capitalize">
                    {videoResult.severity} Risk Corridor
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Road Surface Quality</span>
                  <span className="text-slate-200 font-mono tabular-nums">
                    {videoResult.roadConditionIndex != null
                      ? `Index ${videoResult.roadConditionIndex}/100`
                      : 'Not computed'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-0.5">Recommended Action</span>
                  <span className="text-slate-200 font-medium truncate">
                    {videoResult.recommendedAction || 'Field inspection queued'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-400">
                <span>
                  Unique count:{' '}
                  <strong className="text-slate-200 font-mono">{videoResult.potholeCount}</strong>
                </span>
                <span>
                  Raw frame detections:{' '}
                  <span className="font-mono text-slate-300">
                    {videoResult.analytics?.totalDetections ??
                      videoResult.rawDetectionCount ??
                      videoResult.potholeCount}
                  </span>{' '}
                  <span className="text-slate-500">(before cross-frame tracking)</span>
                </span>
                {(videoResult.analytics?.tentativePotholeCount ?? 0) > 0 && (
                  <span>
                    Tentative tracks:{' '}
                    <span className="font-mono text-amber-300">
                      {videoResult.analytics?.tentativePotholeCount}
                    </span>{' '}
                    <span className="text-slate-500">(visible too briefly to confirm; not counted)</span>
                  </span>
                )}
              </div>

              {videoResult.limitations && videoResult.limitations.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  {videoResult.limitations.map((limitation, idx) => (
                    <p key={`video-limitation-${idx}`} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                      <span>{limitation}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
