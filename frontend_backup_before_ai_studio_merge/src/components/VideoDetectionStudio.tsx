import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Video, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  ShieldCheck, 
  RotateCcw, 
  Download, 
  FileJson, 
  Clock, 
  Film, 
  CheckCircle2, 
  Layers, 
  Sliders, 
  HelpCircle,
  Play,
  Pause,
  Maximize2,
  Info,
  ChevronRight,
  Crosshair,
  TrendingUp,
  AlertTriangle,
  FileVideo,
  Square,
  Tag,
  Camera
} from 'lucide-react';
import { 
  VideoDetectionResponse, 
  VideoDetectionState, 
  FrameDetectionResult, 
  PotholePrediction,
  PotholeSeverity 
} from '../types/detection';
import { detectVideo } from '../services/api';
import { CameraCapture } from './CameraCapture';

interface VideoDetectionStudioProps {
  onNavigate?: (tab: any) => void;
}

const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

export const VideoDetectionStudio: React.FC<VideoDetectionStudioProps> = () => {
  const [videoState, setVideoState] = useState<VideoDetectionState>({ status: 'idle' });
  const [confidence, setConfidence] = useState<number>(20);
  const [iouThreshold, setIouThreshold] = useState<number>(0.70);
  const [extractionFps, setExtractionFps] = useState<number>(1.0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null);
  const [filterDetectionsOnly, setFilterDetectionsOnly] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [processingStep, setProcessingStep] = useState<number>(1);

  // Camera modal state
  const [showCamera, setShowCamera] = useState<boolean>(false);

  // Overlay layer toggles
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const resultVideoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Track the active blob URL in a ref so we can safely revoke it only on
  // unmount or explicit reset — NOT on every videoState transition (which
  // was causing the video src to die mid-playback).
  const blobUrlRef = useRef<string | null>(null);

  // Simulated processing stages for smooth user feedback
  useEffect(() => {
    let interval: any;
    if (videoState.status === 'processing') {
      setProcessingStep(1);
      interval = setInterval(() => {
        setProcessingStep((prev) => (prev < 4 ? prev + 1 : prev));
      }, 3500);
    } else {
      setProcessingStep(1);
    }
    return () => clearInterval(interval);
  }, [videoState.status]);

  // Keep blobUrlRef in sync whenever a new blob URL is assigned to state.
  // We intentionally do NOT revoke here — revocation only happens on
  // explicit reset or final component unmount to avoid killing the video src
  // mid-playback as state transitions through processing → success.
  useEffect(() => {
    const url = 'previewUrl' in videoState ? videoState.previewUrl ?? null : null;
    if (url && url.startsWith('blob:')) {
      blobUrlRef.current = url;
    }
  }, [videoState]);

  // Revoke the blob URL only when the component is fully unmounted.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []); // empty deps — runs cleanup only on unmount

  const handleFile = (file: File) => {
    // Validate file type
    const validExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    const isVideoMime = file.type.startsWith('video/');

    if (!hasValidExt && !isVideoMime) {
      setVideoState({
        status: 'error',
        error: 'Invalid file format',
        details: `File "${file.name}" is not a supported video format. Please upload MP4, WebM, MOV, AVI, or MKV.`,
      });
      return;
    }

    // Validate size limit (50MB backend limit)
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setVideoState({
        status: 'error',
        error: 'File Too Large',
        details: `Video file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum limit of ${MAX_VIDEO_SIZE_MB} MB. Please compress or clip your video.`,
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setVideoState({
      status: 'video-selected',
      file,
      previewUrl,
      name: file.name,
      size: file.size,
    });
    setSelectedFrameIndex(null);
    setVideoDuration(null);
    setVideoDimensions(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const target = e.currentTarget;
    setVideoDuration(target.duration);
    setVideoDimensions({
      width: target.videoWidth,
      height: target.videoHeight,
    });
  };

  const handleStartAnalysis = async () => {
    if (videoState.status !== 'video-selected' && videoState.status !== 'error') return;
    const file = videoState.file;
    const previewUrl = videoState.previewUrl || (file ? URL.createObjectURL(file) : '');
    const name = file ? file.name : 'pothole_video.mp4';

    if (!file) return;

    setVideoState({
      status: 'processing',
      file,
      previewUrl,
      name,
    });

    try {
      const response = await detectVideo(file, {
        confidence,
        iou: iouThreshold,
        fps: extractionFps,
      });

      setVideoState({
        status: 'success',
        result: response,
        previewUrl,
        file,
      });

      // Auto-select first frame with detections if available
      const firstFrameWithDet = response.frames.findIndex(f => f.predictions && f.predictions.length > 0);
      if (firstFrameWithDet !== -1) {
        setSelectedFrameIndex(firstFrameWithDet);
      } else if (response.frames.length > 0) {
        setSelectedFrameIndex(0);
      }
    } catch (err: any) {
      console.error('Video detection error:', err);
      setVideoState({
        status: 'error',
        error: 'Video Analysis Failed',
        details: err instanceof Error ? err.message : 'An unexpected error occurred while communicating with the video detection service.',
        file,
        previewUrl,
      });
    }
  };

  const handleReset = () => {
    // Revoke the tracked blob URL now that the user is explicitly resetting.
    if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setVideoState({ status: 'idle' });
    setSelectedFrameIndex(null);
    setVideoDuration(null);
    setVideoDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const seekToTimestamp = (seconds: number) => {
    if (resultVideoRef.current) {
      resultVideoRef.current.currentTime = seconds;
      renderDetectionOverlay();
    }
  };

  const handleExportJSON = () => {
    if (videoState.status !== 'success') return;
    const jsonStr = JSON.stringify(videoState.result, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadguard-video-analysis-${videoState.result.video.filename.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityStyle = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return {
          stroke: '#EF4444',
          fill: 'rgba(239, 68, 68, 0.35)',
          badge: 'bg-red-500/20 text-red-400 border-red-500/40',
          badgeBg: 'rgba(239, 68, 68, 0.25)',
          badgeText: '#F87171',
        };
      case 'high':
        return {
          stroke: '#F97316',
          fill: 'rgba(249, 115, 22, 0.32)',
          badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
          badgeBg: 'rgba(249, 115, 22, 0.25)',
          badgeText: '#FB923C',
        };
      case 'moderate':
        return {
          stroke: '#F59E0B',
          fill: 'rgba(245, 158, 11, 0.30)',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          badgeBg: 'rgba(245, 158, 11, 0.25)',
          badgeText: '#FBBF24',
        };
      case 'minor':
      default:
        return {
          stroke: '#10B981',
          fill: 'rgba(16, 185, 129, 0.28)',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          badgeBg: 'rgba(16, 185, 129, 0.25)',
          badgeText: '#34D399',
        };
    }
  };

  const getRiskColor = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-red-400 border-red-500/40 bg-red-500/10';
      case 'HIGH':
        return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
      case 'MEDIUM':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
      case 'LOW':
      default:
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    }
  };

  // Keep ref to selectedFrameIndex to avoid recreating callbacks/listeners unnecessarily
  const selectedFrameRef = useRef<number | null>(selectedFrameIndex);
  useEffect(() => {
    selectedFrameRef.current = selectedFrameIndex;
  }, [selectedFrameIndex]);

  // On successful analysis, seek video to initial selected frame
  useEffect(() => {
    if (videoState.status === 'success' && resultVideoRef.current && selectedFrameIndex !== null) {
      const frame = videoState.result.frames.find(f => f.frameIndex === selectedFrameIndex);
      if (frame && Math.abs(resultVideoRef.current.currentTime - frame.timestamp) > 0.05) {
        resultVideoRef.current.currentTime = frame.timestamp;
      }
    }
  }, [videoState.status]);

  /**
   * Render Canvas Overlay precisely matching HTML5 video element display box
   */
  const renderDetectionOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const video = resultVideoRef.current;

    if (!canvas || !video || videoState.status !== 'success') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const elW = video.clientWidth || canvas.clientWidth;
    const elH = video.clientHeight || canvas.clientHeight;

    if (elW === 0 || elH === 0) return;

    // Synchronize canvas internal buffer size
    if (canvas.width !== elW || canvas.height !== elH) {
      canvas.width = elW;
      canvas.height = elH;
    }

    ctx.clearRect(0, 0, elW, elH);

    // Original video dimensions from backend metadata or video natural resolution
    const origW = videoState.result.video.width || video.videoWidth || 640;
    const origH = videoState.result.video.height || video.videoHeight || 360;

    // Calculate object-contain aspect scaling & letterbox offsets
    const videoAspect = origW / origH;
    const elementAspect = elW / elH;

    let renderW = elW;
    let renderH = elH;
    let offsetX = 0;
    let offsetY = 0;

    if (elementAspect > videoAspect) {
      // Pillarbox (black bars left and right)
      renderH = elH;
      renderW = elH * videoAspect;
      offsetX = (elW - renderW) / 2;
      offsetY = 0;
    } else {
      // Letterbox (black bars top and bottom)
      renderW = elW;
      renderH = elW / videoAspect;
      offsetX = 0;
      offsetY = (elH - renderH) / 2;
    }

    const scaleX = renderW / origW;
    const scaleY = renderH / origH;

    // Determine current active frame from video currentTime
    const frames = videoState.result.frames || [];
    if (frames.length === 0) return;

    const currentTime = video.currentTime;
    const extractionRate = videoState.result.processing.extractionFps || 1.0;
    const frameInterval = 1.0 / extractionRate;

    // Find nearest sampled frame to currentTime
    let activeFrame: FrameDetectionResult | undefined;
    let minDiff = Infinity;

    for (const f of frames) {
      const diff = Math.abs(f.timestamp - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        activeFrame = f;
      }
    }

    // Only display detections if within the temporal vicinity of the sampled frame
    if (minDiff > Math.max(frameInterval * 0.75, 0.5)) {
      activeFrame = undefined;
    }

    // If no active frame or no detections in frame, canvas remains cleared
    if (!activeFrame || !activeFrame.predictions || activeFrame.predictions.length === 0) {
      return;
    }

    // Render detections for active frame
    activeFrame.predictions.forEach((pred) => {
      const sev = (pred.severity || 'moderate').toLowerCase();
      const style = getSeverityStyle(sev);

      const boxX = offsetX + (pred.x - pred.width / 2) * scaleX;
      const boxY = offsetY + (pred.y - pred.height / 2) * scaleY;
      const boxW = Math.max(pred.width * scaleX, 10);
      const boxH = Math.max(pred.height * scaleY, 8);

      // 1. Polygon Segmentation Mask Outline
      if (showPolygons && pred.points && pred.points.length > 2) {
        ctx.save();
        ctx.beginPath();
        pred.points.forEach((pt, pIdx) => {
          const px = offsetX + pt.x * scaleX;
          const py = offsetY + pt.y * scaleY;
          if (pIdx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();

        ctx.fillStyle = style.fill;
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = style.stroke;
        ctx.shadowColor = style.stroke;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Precision Bounding Box & Technical Reticles
      if (showBoundingBoxes || (!pred.points || pred.points.length <= 2)) {
        ctx.save();
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 2;
        ctx.setLineDash(pred.points && showPolygons ? [4, 4] : []);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Fill bounding box if polygon not active or unavailable
        if (!pred.points || !showPolygons) {
          ctx.fillStyle = style.fill;
          ctx.fillRect(boxX, boxY, boxW, boxH);
        }

        // Technical HUD Corner Brackets
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        ctx.shadowColor = style.stroke;
        ctx.shadowBlur = 6;
        const corner = Math.min(10, Math.max(4, boxW / 3, boxH / 3));

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

      // 3. Technical HUD Label Tag
      if (showLabels) {
        ctx.save();
        const confText = `${(pred.confidence * 100).toFixed(1)}%`;
        const sevUpper = sev.toUpperCase();
        const labelText = `POTHOLE ${confText} [${sevUpper}]`;

        ctx.font = 'bold 10px "JetBrains Mono", monospace, sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const padX = 6;
        const padY = 3;
        const badgeW = textMetrics.width + padX * 2;
        const badgeH = 18;

        let badgeX = boxX;
        let badgeY = boxY - badgeH - 3;
        if (badgeY < offsetY) {
          badgeY = boxY + boxH + 3;
        }
        if (badgeX + badgeW > offsetX + renderW) {
          badgeX = offsetX + renderW - badgeW;
        }
        if (badgeX < offsetX) {
          badgeX = offsetX;
        }

        // Dark background pill
        ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.stroke();

        // Label text
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(`POTHOLE ${confText} `, badgeX + padX, badgeY + 12);

        // Severity highlight
        const prefixWidth = ctx.measureText(`POTHOLE ${confText} `).width;
        ctx.fillStyle = style.badgeText;
        ctx.fillText(`[${sevUpper}]`, badgeX + padX + prefixWidth, badgeY + 12);

        ctx.restore();
      }
    });
  }, [
    videoState,
    showPolygons,
    showBoundingBoxes,
    showLabels,
  ]);

  // Video playback & resize synchronization hook
  useEffect(() => {
    if (videoState.status !== 'success') return;

    const video = resultVideoRef.current;
    if (!video) return;

    let animationId: number;

    const syncFrameSelection = () => {
      const currentTime = video.currentTime;
      const frames = videoState.result.frames || [];
      const extractionRate = videoState.result.processing.extractionFps || 1.0;
      const frameInterval = 1.0 / extractionRate;

      let nearestFrame: FrameDetectionResult | undefined;
      let minDiff = Infinity;
      for (const f of frames) {
        const diff = Math.abs(f.timestamp - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          nearestFrame = f;
        }
      }

      if (nearestFrame && minDiff <= Math.max(frameInterval * 0.75, 0.5)) {
        if (nearestFrame.frameIndex !== selectedFrameRef.current) {
          selectedFrameRef.current = nearestFrame.frameIndex;
          setSelectedFrameIndex(nearestFrame.frameIndex);
        }
      }
    };

    const renderLoop = () => {
      renderDetectionOverlay();
      syncFrameSelection();
      if (!video.paused && !video.ended) {
        animationId = requestAnimationFrame(renderLoop);
      }
    };

    // Initial render and sync
    renderDetectionOverlay();
    syncFrameSelection();

    const handlePlay = () => {
      cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(renderLoop);
    };

    const handlePause = () => {
      cancelAnimationFrame(animationId);
      renderDetectionOverlay();
      syncFrameSelection();
    };

    const handleSeeking = () => {
      renderDetectionOverlay();
      syncFrameSelection();
    };

    const handleSeeked = () => {
      renderDetectionOverlay();
      syncFrameSelection();
    };

    const handleTimeUpdate = () => {
      renderDetectionOverlay();
      syncFrameSelection();
    };

    const handleLoadedMetadata = () => {
      renderDetectionOverlay();
      syncFrameSelection();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedMetadata);

    const handleResize = () => {
      renderDetectionOverlay();
    };
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        renderDetectionOverlay();
      });
      resizeObserver.observe(video);
      if (overlayCanvasRef.current) {
        resizeObserver.observe(overlayCanvasRef.current);
      }
    }

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedMetadata);
    };
  }, [videoState, renderDetectionOverlay]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Camera capture modal — video mode */}
      {showCamera && (
        <CameraCapture
          defaultMode="video"
          onPhotoCapture={() => {
            // Video studio — photo not applicable
            setShowCamera(false);
          }}
          onVideoCapture={(file) => {
            // Pass directly through the existing handleFile pathway
            handleFile(file);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Studio Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              VIDEO SURVEILLANCE &amp; TRACKING
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
              IoU DEDUPLICATION
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
            <Video className="w-6 h-6 text-amber-400" />
            <span>AI Video Pothole Detection Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuous Road Survey Video Analysis with FFmpeg Keyframe Extraction, Roboflow YOLOv11 Inference, and Spatial-Temporal Pothole Tracking
          </p>
        </div>

        {videoState.status === 'success' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Export complete frame telemetry as JSON"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Export JSON Report</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-sm shadow-amber-500/20 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Video Analysis</span>
            </button>
          </div>
        )}
      </div>

      {/* IDLE STATE: Upload Dropzone & Info */}
      {videoState.status === 'idle' && (
        <div className="space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-700/80 hover:border-amber-500/60 bg-slate-900/40 hover:bg-slate-900/70 rounded-2xl p-10 md:p-14 text-center transition-all flex flex-col items-center justify-center gap-4 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Video className="w-8 h-8 stroke-[1.8]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                Drop Road Survey Video Here
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Upload dashcam recordings, drone scans, or smartphone survey video clips to detect and track potholes automatically.
              </p>
            </div>

            {/* Upload + Camera row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <button
                type="button"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-md shadow-amber-500/20"
                onClick={() => fileInputRef.current?.click()}
              >
                <span>Browse Device Videos</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-amber-500/40 text-slate-200 hover:text-amber-400 font-bold text-xs rounded-xl cursor-pointer transition-all"
                aria-label="Open camera to record a video"
              >
                <Camera className="w-4 h-4" />
                Record with Camera
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-wrap justify-center items-center gap-3 text-[11px] font-mono text-slate-500 mt-2">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">MP4</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">WEBM</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">MOV</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">AVI</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">MKV</span>
              <span>·</span>
              <span className="text-amber-400/90 font-semibold">Max {MAX_VIDEO_SIZE_MB}MB</span>
              <span>·</span>
              <span>Direct FFmpeg Keyframe Pipeline</span>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Film className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">FFmpeg Keyframe Sampling</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Extracts high-resolution video frames at configurable extraction rates, sampling optimal snapshots for model inference.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <Crosshair className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">IoU Spatial Deduplication</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tracks detected potholes across consecutive video frames using Intersection-over-Union matching to prevent double-counting.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Municipal Analytics &amp; DB</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aggregates overall roadway risk, maximum confidence, and damage percentages, persisting full inspection telemetry to MySQL.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SELECTED VIDEO PREVIEW & CONFIGURATION */}
      {videoState.status === 'video-selected' && (
        <div className="grid lg:grid-cols-3 gap-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          {/* Video Preview Player (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative min-h-[360px] max-h-[480px]">
              <video
                ref={videoPlayerRef}
                src={videoState.previewUrl}
                controls
                playsInline
                onLoadedMetadata={handleVideoLoadedMetadata}
                className="max-h-[460px] w-full object-contain rounded-lg bg-black"
              />
            </div>

            {/* Video File Information Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <span className="text-slate-500 text-[10px] block">FILE NAME</span>
                <span className="text-slate-200 font-semibold truncate block" title={videoState.name}>
                  {videoState.name}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <span className="text-slate-500 text-[10px] block">FILE SIZE</span>
                <span className="text-slate-200 font-semibold block">
                  {(videoState.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <span className="text-slate-500 text-[10px] block">DURATION</span>
                <span className="text-slate-200 font-semibold block">
                  {videoDuration !== null ? `${videoDuration.toFixed(1)}s` : 'Loading...'}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <span className="text-slate-500 text-[10px] block">RESOLUTION</span>
                <span className="text-slate-200 font-semibold block">
                  {videoDimensions ? `${videoDimensions.width}x${videoDimensions.height}` : 'Detecting...'}
                </span>
              </div>
            </div>
          </div>

          {/* Control Panel (1 col) */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase">
                  Survey Video Loaded
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Configure Detection Parameters
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  Adjust confidence sensitivity and extraction settings before initiating deep Roboflow YOLOv11 inspection.
                </p>
              </div>

              {/* Confidence Controls */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Confidence Threshold</span>
                  <span className="font-mono text-amber-400 font-bold text-sm">{confidence}%</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfidence(20)}
                    className={`py-1.5 px-2 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      confidence === 20
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    20% (Default)
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfidence(30)}
                    className={`py-1.5 px-2 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      confidence === 30
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    30% (Strict)
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfidence(50)}
                    className={`py-1.5 px-2 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      confidence === 50
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    50% (High)
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 leading-snug">
                  <p className="text-amber-300/90 font-semibold mb-0.5">Threshold Guidance:</p>
                  <p>
                    • At <strong>20%</strong>: Captures faint surface defects and fissure cracks (~0.26+).
                  </p>
                  <p>
                    • At <strong>30%</strong>: Excludes marginal blemishes and isolates high-confidence potholes (~0.83+).
                  </p>
                </div>
              </div>

              {/* Collapsible Advanced Settings */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Advanced Video Tuning</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {showAdvanced ? 'Collapse' : 'Expand'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="p-4 pt-0 space-y-3 border-t border-slate-800/80 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Extraction Rate</span>
                        <span className="font-mono text-amber-400">{extractionFps} FPS</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.5"
                        value={extractionFps}
                        onChange={(e) => setExtractionFps(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-500">
                        Default 1 FPS extracts 1 sampled keyframe per second of video.
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-900">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>IoU Tracking Threshold</span>
                        <span className="font-mono text-amber-400">{(iouThreshold * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.40"
                        max="0.90"
                        step="0.05"
                        value={iouThreshold}
                        onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-500">
                        Controls spatial overlap required to merge detections across consecutive frames.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Start Video AI Analysis</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Choose Another Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING STATE */}
      {videoState.status === 'processing' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 md:p-14 text-center flex flex-col items-center justify-center gap-6">
          {/* Animated Video Scanning Frame */}
          <div className="relative w-80 h-48 rounded-xl overflow-hidden border border-amber-500/40 bg-slate-950 shadow-2xl shadow-amber-500/10">
            {videoState.previewUrl && (
              <video
                src={videoState.previewUrl}
                muted
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover opacity-35 filter contrast-125"
              />
            )}
            {/* Animated Laser Scanning Beam */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_16px_#f59e0b] animate-[bounce_2s_infinite]" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
            
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-amber-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>FFMPEG + YOLOv11</span>
              </span>
              <span>CONF: {confidence}%</span>
            </div>
          </div>

          {/* Processing Progress Steps */}
          <div className="space-y-4 max-w-md w-full">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                SURVEILLANCE INFERENCE ENGINE ACTIVE
              </span>
              <h3 className="text-xl font-bold text-white">
                Processing Road Video Stream...
              </h3>
              <p className="text-xs text-slate-400">
                Please wait while frames are sampled, sent to the model, deduplicated, and analyzed.
              </p>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="space-y-2 text-left bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-xs font-mono">
              <div className={`flex items-center gap-2.5 ${processingStep >= 1 ? 'text-amber-400' : 'text-slate-600'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep >= 1 ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                <span>1. Validating video format &amp; extracting sampled frames</span>
              </div>
              <div className={`flex items-center gap-2.5 ${processingStep >= 2 ? 'text-amber-400' : 'text-slate-600'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep >= 2 ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                <span>2. Executing Roboflow YOLOv11 instance segmentation</span>
              </div>
              <div className={`flex items-center gap-2.5 ${processingStep >= 3 ? 'text-amber-400' : 'text-slate-600'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep >= 3 ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                <span>3. IoU spatial-temporal tracking across frame timeline</span>
              </div>
              <div className={`flex items-center gap-2.5 ${processingStep >= 4 ? 'text-amber-400' : 'text-slate-600'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep >= 4 ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
                <span>4. Computing municipal road risk &amp; persisting to MySQL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {videoState.status === 'error' && (
        <div className="bg-slate-900/60 border border-red-500/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              {videoState.error}
            </h3>
            {videoState.details && (
              <p className="text-xs text-red-300 max-w-lg mx-auto font-mono bg-red-950/30 p-3 rounded-lg border border-red-900/50 mt-2">
                {videoState.details}
              </p>
            )}
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
              Ensure the backend service is running on port 3001 and your video is a valid MP4/WebM/MOV file under {MAX_VIDEO_SIZE_MB}MB.
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            {videoState.file && (
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm shadow-amber-500/20 cursor-pointer"
              >
                Retry Analysis
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Choose Another Video
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS STATE: ANALYTICS, VIDEO TIMELINE & FRAME INSPECTOR */}
      {videoState.status === 'success' && (
        <div className="space-y-6">
          {/* Top Analytics KPI Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Unique Potholes (Highlighted) */}
            <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-xl relative overflow-hidden">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                UNIQUE POTHOLES
              </span>
              <div className="text-3xl font-black text-amber-400 mt-1 font-mono">
                {videoState.result.analytics.uniquePotholeCount}
              </div>
              <span className="text-[10px] text-amber-300/80 font-mono block mt-0.5">
                IoU Deduplicated Defect Count
              </span>
            </div>

            {/* Raw Frame Detections */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                RAW DETECTIONS
              </span>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {videoState.result.analytics.totalDetections}
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Across all sampled frames
              </span>
            </div>

            {/* Frames with Detections */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                ACTIVE FRAMES
              </span>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {videoState.result.analytics.framesWithDetections} / {videoState.result.processing.totalFrames}
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Frames with defects
              </span>
            </div>

            {/* Overall Risk Level */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                ROAD RISK LEVEL
              </span>
              <div className={`text-2xl font-black mt-1 font-mono uppercase ${getRiskColor(videoState.result.analytics.overallRiskLevel).split(' ')[0]}`}>
                {videoState.result.analytics.overallRiskLevel || 'LOW'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Structural assessment
              </span>
            </div>

            {/* Peak Confidence */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                PEAK CONFIDENCE
              </span>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {(videoState.result.analytics.maxConfidence * 100).toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Highest model certainty
              </span>
            </div>

            {/* Average Damage % */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                AVG DAMAGE AREA
              </span>
              <div className="text-2xl font-black text-white mt-1 font-mono">
                {videoState.result.analytics.avgDamagePercentage}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Surface area ratio
              </span>
            </div>
          </div>

          {/* IoU Deduplication & Persistence Banner */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-200">
                  Raw Detections ({videoState.result.analytics.totalDetections}) vs. Unique Potholes ({videoState.result.analytics.uniquePotholeCount})
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  As the vehicle traverses the road, a single pothole is captured across multiple sequential video frames. RoadGuard's spatial-temporal IoU tracking matches overlapping bounding boxes, ensuring municipal work orders record exactly <strong>{videoState.result.analytics.uniquePotholeCount} distinct road defect(s)</strong> rather than inflated duplicates.
                </p>
              </div>
            </div>

            {videoState.result.persistence?.saved && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-nowrap font-mono text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Inspection #{videoState.result.persistence.inspectionId} Saved to MySQL</span>
              </div>
            )}
          </div>

          {/* Main Inspection Layout (Split 2 cols / 1 col) */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Video Player with Live Overlay Canvas + Interactive Frame Timeline (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Synchronized Video Player with Canvas HUD */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                {/* Header & Layer Toggles Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-300 pb-2 border-b border-slate-800">
                  <span className="flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-amber-400" />
                    <span>Inspection HUD — {videoState.result.video.filename}</span>
                  </span>

                  {/* Overlay Controls */}
                  <div className="flex items-center gap-3 font-mono text-[11px]">
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
                      <span>Boxes</span>
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

                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                      LIVE HUD OVERLAY
                    </span>
                  </div>
                </div>

                {/* Video & Canvas Overlay Viewport - Shared 16:9 Stage */}
                <div
                  className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center"
                  style={{ aspectRatio: '16 / 9' }}
                >
                  {/* Video sits at z-index 10 so the browser native controls
                      render within its own stacking context. The canvas sits
                      at z-index 20 (above) for overlay painting, but
                      pointer-events-none ensures all clicks/taps pass through
                      to the video element and its native controls. */}
                  <video
                    ref={resultVideoRef}
                    src={videoState.previewUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain block bg-black"
                    style={{ position: 'relative', zIndex: 10 }}
                  />
                  {/* Detection HUD canvas — floats above video visually but
                      never intercepts pointer events (pointer-events-none). */}
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ zIndex: 20 }}
                  />
                </div>

                {/* Video & Processing Telemetry Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">RESOLUTION &amp; FPS</span>
                    <span className="text-slate-200">
                      {videoState.result.video.width}&times;{videoState.result.video.height} @ {videoState.result.video.fps} FPS
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">VIDEO DURATION</span>
                    <span className="text-slate-200">{videoState.result.video.duration.toFixed(1)} seconds</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">EXTRACTION RATE</span>
                    <span className="text-slate-200">{videoState.result.processing.extractionFps} FPS sampling</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">SAMPLED FRAMES</span>
                    <span className="text-slate-200">{videoState.result.processing.totalFrames} frames</span>
                  </div>
                </div>
              </div>

              {/* Frame Timeline Ribbon */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Frame Timeline Scrubber</span>
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <label className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterDetectionsOnly}
                        onChange={(e) => setFilterDetectionsOnly(e.target.checked)}
                        className="accent-amber-500 rounded"
                      />
                      <span>Show Detections Only</span>
                    </label>
                  </div>
                </div>

                {/* Timeline Bar with Frame Markers */}
                <div className="flex gap-1.5 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-slate-700">
                  {videoState.result.frames
                    .filter((f) => !filterDetectionsOnly || (f.predictions && f.predictions.length > 0))
                    .map((frame) => {
                      const hasDetections = frame.predictions && frame.predictions.length > 0;
                      const isSelected = selectedFrameIndex === frame.frameIndex;

                      return (
                        <button
                          key={frame.frameIndex}
                          type="button"
                          onClick={() => {
                            setSelectedFrameIndex(frame.frameIndex);
                            seekToTimestamp(frame.timestamp);
                          }}
                          className={`flex-shrink-0 flex flex-col items-center p-2 rounded-lg border text-[11px] font-mono transition-all cursor-pointer min-w-[72px] ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10 scale-105'
                              : hasDetections
                              ? 'bg-slate-900/90 border-amber-500/40 text-amber-400 hover:bg-slate-800'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <span className="font-bold">F#{frame.frameIndex + 1}</span>
                          <span className="text-[10px] text-slate-400">{frame.timestamp.toFixed(1)}s</span>
                          {hasDetections ? (
                            <span className="mt-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-slate-950">
                              {frame.predictions.length} {frame.predictions.length === 1 ? 'hit' : 'hits'}
                            </span>
                          ) : (
                            <span className="mt-1 text-[9px] text-slate-600">clean</span>
                          )}
                        </button>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                  <span>Click any frame above to seek player &amp; display detection overlays</span>
                  <span>Extracted at {videoState.result.processing.extractionFps} FPS</span>
                </div>
              </div>
            </div>

            {/* Right: Frame-Level Inspection & Prediction Details (1 col) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Frame Inspector</span>
                      {selectedFrameIndex !== null && (
                        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          Frame #{selectedFrameIndex + 1}
                        </span>
                      )}
                    </h3>
                  </div>

                  {selectedFrameIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        const frame = videoState.result.frames.find(f => f.frameIndex === selectedFrameIndex);
                        if (frame) seekToTimestamp(frame.timestamp);
                      }}
                      className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play @ Frame</span>
                    </button>
                  )}
                </div>

                {/* Selected Frame Metrics */}
                {selectedFrameIndex !== null ? (() => {
                  const currentFrame = videoState.result.frames.find(f => f.frameIndex === selectedFrameIndex);
                  if (!currentFrame) {
                    return <div className="text-xs text-slate-500">Frame not found.</div>;
                  }

                  const preds = currentFrame.predictions || [];

                  return (
                    <div className="space-y-3">
                      {/* Frame Stats Ribbon */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">TIMESTAMP</span>
                          <span className="text-slate-200 font-bold">{currentFrame.timestamp.toFixed(2)}s</span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">FRAME RISK</span>
                          <span className={`font-bold uppercase ${getRiskColor(currentFrame.analytics.overallRiskLevel).split(' ')[0]}`}>
                            {currentFrame.analytics.overallRiskLevel}
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">DAMAGE RATIO</span>
                          <span className="text-slate-200 font-bold">{currentFrame.analytics.damagePercentage}%</span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">MAX CONFIDENCE</span>
                          <span className="text-amber-400 font-bold">
                            {(currentFrame.analytics.maxConfidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Frame Detections List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                          <span>Frame Detections ({preds.length})</span>
                          <span className="text-[10px] font-mono text-slate-500">&ge; {confidence}% threshold</span>
                        </div>

                        {preds.length === 0 ? (
                          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500 space-y-1">
                            <ShieldCheck className="w-6 h-6 text-emerald-500/60 mx-auto" />
                            <p className="text-slate-400 font-medium">No potholes in this frame</p>
                            <p className="text-[11px] text-slate-600">Surface satisfies municipal quality criteria.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {preds.map((p, pIdx) => {
                              const sev = (p.severity || 'moderate').toLowerCase();
                              const badgeStyle = getSeverityStyle(sev);

                              return (
                                <div
                                  key={p.id || pIdx}
                                  className="p-3 rounded-xl border bg-slate-950 border-slate-800 hover:border-amber-500/40 text-xs transition-all space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white font-mono flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                                      <span>#{pIdx + 1} {p.class || 'Pothole'}</span>
                                    </span>
                                    <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${badgeStyle.badge}`}>
                                      {sev}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                                    <div>
                                      <span className="text-slate-500">Confidence: </span>
                                      <span className="text-amber-400 font-semibold">
                                        {(p.confidence * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Area Ratio: </span>
                                      <span className="text-slate-200">
                                        {p.areaRatio ? `${p.areaRatio}%` : 'N/A'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Center: </span>
                                      <span className="text-slate-200">
                                        ({Math.round(p.x)}, {Math.round(p.y)})
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Bounding Box: </span>
                                      <span className="text-slate-200">
                                        {Math.round(p.width)}&times;{Math.round(p.height)}px
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-center py-10 text-xs text-slate-500">
                    Select a frame on the timeline to inspect its detected road defects.
                  </div>
                )}
              </div>

              {/* Bottom Quick-Action Panel */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Model: YOLOv11 Instance Seg</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Analyze Another Video</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
