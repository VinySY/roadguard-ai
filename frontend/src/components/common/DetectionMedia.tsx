import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, Loader2, Maximize2, VideoOff, X } from 'lucide-react';
import type { BoundingBox, DetectionResult } from '../../types';
import { findClosestVideoFrame } from '../../services/annotations';
import { resolveMediaUrl } from '../../services/media';

interface DetectionOverlayProps {
  boxes: BoundingBox[];
  imageWidth: number;
  imageHeight: number;
}

const SEVERITY_COLORS: Record<string, { stroke: string; fill: string; badge: string; corner: string }> = {
  critical: {
    stroke: '#EF4444',
    fill: 'rgba(239, 68, 68, 0.32)',
    badge: 'bg-rose-600 text-white',
    corner: 'border-rose-400',
  },
  high: {
    stroke: '#F97316',
    fill: 'rgba(249, 115, 22, 0.28)',
    badge: 'bg-orange-600 text-white',
    corner: 'border-orange-400',
  },
  medium: {
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.25)',
    badge: 'bg-amber-500 text-slate-950',
    corner: 'border-amber-300',
  },
  low: {
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.25)',
    badge: 'bg-amber-500 text-slate-950',
    corner: 'border-amber-300',
  },
};

/**
 * Draws the persisted boxes and segmentation polygons on top of the original
 * image/video frame. Geometry is never synthesised: an empty list renders
 * nothing.
 */
export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  boxes,
  imageWidth,
  imageHeight,
}) => {
  if (!boxes || boxes.length === 0) return null;

  const safeWidth = Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : 640;
  const safeHeight = Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : 640;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${safeWidth} ${safeHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {boxes.map((box, index) => {
          if (!box.points || box.points.length < 3) return null;
          const colors = SEVERITY_COLORS[box.severity || 'low'] || SEVERITY_COLORS.low;
          const points = box.points.map((point) => `${point.x},${point.y}`).join(' ');
          return (
            <polygon
              key={`poly-${box.id || index}`}
              points={points}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {boxes.map((box, index) => {
        const colors = SEVERITY_COLORS[box.severity || 'low'] || SEVERITY_COLORS.low;
        const left = `${Math.max(0, Math.min(1, box.x)) * 100}%`;
        const top = `${Math.max(0, Math.min(1, box.y)) * 100}%`;
        const width = `${Math.max(0, Math.min(1, box.width)) * 100}%`;
        const height = `${Math.max(0, Math.min(1, box.height)) * 100}%`;

        return (
          <div
            key={`box-${box.id || index}`}
            style={{ position: 'absolute', left, top, width, height }}
            className={`rounded border-2 ${colors.corner} shadow-sm`}
          >
            <div className={`absolute inset-0 rounded ${colors.stroke === '#EF4444' ? 'bg-rose-500/20' : colors.stroke === '#F97316' ? 'bg-orange-500/20' : 'bg-amber-400/20'}`} />
            <span className={`absolute -left-0.5 -top-0.5 h-2 w-2 border-l-2 border-t-2 ${colors.corner}`} />
            <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 border-r-2 border-t-2 ${colors.corner}`} />
            <span className={`absolute -bottom-0.5 -left-0.5 h-2 w-2 border-b-2 border-l-2 ${colors.corner}`} />
            <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 border-b-2 border-r-2 ${colors.corner}`} />
            <div className={`absolute -top-5 left-0 z-10 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-bold shadow ${colors.badge}`}>
              #{index + 1} {box.class || 'pothole'} {Math.round((box.confidence || 0) * 100)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface DetectionMediaProps {
  imageSrc?: string | null;
  videoSrc?: string | null;
  detection?: DetectionResult | null;
  alt: string;
  caption?: string;
  className?: string;
  /** Tailwind max-height utility applied to the media element, e.g. max-h-[320px]. */
  maxHeightClassName?: string;
  allowFullView?: boolean;
  emptyLabel?: string;
}

/**
 * Shared evidence renderer for citizen, worker, inspector and archive views.
 * It keeps the original media and draws only persisted detection geometry.
 */
export const DetectionMedia: React.FC<DetectionMediaProps> = ({
  imageSrc,
  videoSrc,
  detection,
  alt,
  caption,
  className = '',
  maxHeightClassName = 'max-h-[320px]',
  allowFullView = true,
  emptyLabel,
}) => {
  // Prefer a server-persisted URL over a session-only blob/data preview. This
  // keeps reports playable even when an older record still carries a blob URL.
  const durableFallback = (primary?: string | null, fallback?: string | null) => {
    const isSessionOnly = Boolean(primary && (primary.startsWith('blob:') || primary.startsWith('data:')));
    if (primary && !isSessionOnly) return primary;
    return fallback || primary;
  };

  const detectionVideoUrl = detection?.video?.url || detection?.videoUrl;
  const resolvedImage = resolveMediaUrl(durableFallback(imageSrc, detection?.imageUrl));
  const resolvedVideo = resolveMediaUrl(durableFallback(videoSrc, detectionVideoUrl));
  const mediaKind: 'video' | 'image' | 'none' = resolvedVideo
    ? 'video'
    : resolvedImage
    ? 'image'
    : 'none';

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    mediaKind === 'none' ? 'error' : 'loading'
  );
  const [videoTime, setVideoTime] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    setStatus(mediaKind === 'none' ? 'error' : 'loading');
    setVideoTime(0);
    setIsPreviewOpen(false);
  }, [mediaKind, resolvedImage, resolvedVideo]);

  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPreviewOpen, closePreview]);

  const videoFrame = useMemo(
    () => (mediaKind === 'video' ? findClosestVideoFrame(detection?.videoFrames, videoTime) : null),
    [mediaKind, detection?.videoFrames, videoTime]
  );

  const boxes = useMemo<BoundingBox[]>(() => {
    if (!detection) return [];
    if (mediaKind === 'video') {
      // When per-frame boxes exist, never show another frame's boxes just
      // because playback is between samples.
      if (detection.videoFrames && detection.videoFrames.length > 0) {
        return videoFrame?.boxes || [];
      }
      return detection.boxes || [];
    }
    return detection.boxes || [];
  }, [detection, mediaKind, videoFrame]);

  const imageWidth =
    detection?.image?.width ||
    (mediaKind === 'video' ? detection?.video?.width : undefined) ||
    640;
  const imageHeight =
    detection?.image?.height ||
    (mediaKind === 'video' ? detection?.video?.height : undefined) ||
    640;

  const isVideo = mediaKind === 'video';
  const unavailableTitle = isVideo ? 'Video unavailable' : 'Photograph unavailable';
  const unavailableBody =
    emptyLabel ||
    (isVideo
      ? 'This report’s video evidence could not be loaded. It may not have been stored, or the saved media path is no longer valid.'
      : 'This report’s pothole photo could not be loaded. The file may be missing or its saved path is no longer valid.');

  const mediaElement = isVideo ? (
    <video
      src={resolvedVideo || undefined}
      controls
      playsInline
      preload="metadata"
      className={`block h-auto w-auto max-w-full rounded-lg bg-black shadow-md ${maxHeightClassName}`}
      onLoadedMetadata={() => setStatus('loaded')}
      onTimeUpdate={(event) => setVideoTime(event.currentTarget.currentTime)}
      onSeeked={(event) => setVideoTime(event.currentTarget.currentTime)}
      onError={() => setStatus('error')}
      aria-label={alt}
    >
      Your browser cannot play this video format.
    </video>
  ) : (
    <img
      src={resolvedImage || undefined}
      alt={alt}
      className={`block h-auto w-auto max-w-full rounded-lg shadow-md ${maxHeightClassName}`}
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('error')}
    />
  );

  if (status === 'error' || mediaKind === 'none') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-6 text-center ${className}`}
        style={{ background: 'var(--rg-bg-deep)', borderColor: 'var(--rg-border-soft)' }}
        role="img"
        aria-label={`${unavailableTitle}: ${alt}`}
      >
        {isVideo ? (
          <VideoOff className="h-6 w-6 text-slate-500" aria-hidden="true" />
        ) : (
          <ImageOff className="h-6 w-6 text-slate-500" aria-hidden="true" />
        )}
        <span className="text-xs font-medium text-slate-300">{unavailableTitle}</span>
        <span className="max-w-[280px] text-[11px] leading-relaxed text-slate-500">{unavailableBody}</span>
        {detection && (
          <span className="mt-1 text-[10px] font-mono text-amber-400/80">
            Detector output remains preserved below.
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`flex w-full items-center justify-center ${className}`}>
        <div className="relative inline-block max-w-full">
          {mediaElement}

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-950/70 text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden="true" />
              <span className="text-[11px] font-medium">
                {isVideo ? 'Loading video…' : 'Loading photograph…'}
              </span>
            </div>
          )}

          {status === 'loaded' && (
            <DetectionOverlay boxes={boxes} imageWidth={imageWidth} imageHeight={imageHeight} />
          )}

          {!isVideo && allowFullView && status === 'loaded' && (
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="absolute bottom-2 right-2 flex min-h-8 items-center gap-1 rounded-lg border border-slate-600/60 bg-slate-950/85 px-2 py-1 text-[11px] font-medium text-slate-100 opacity-90 backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100"
              aria-label={`View full-size annotated photograph: ${alt}`}
            >
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
              View
            </button>
          )}

          {isVideo && detection?.videoFrames && detection.videoFrames.length > 0 && (
            <span className="pointer-events-none absolute left-2 top-2 rounded border border-slate-700/80 bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] text-amber-300 backdrop-blur-sm">
              {videoFrame ? `frame @ ${videoFrame.timestamp.toFixed(1)}s` : 'annotations between samples'}
            </span>
          )}
        </div>
      </div>

      {isPreviewOpen && resolvedImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Full-size annotated photographic evidence"
            onClick={closePreview}
          >
            <div
              className="relative flex max-h-[92vh] max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">{alt}</p>
                  {caption && <p className="mt-0.5 truncate text-[11px] text-slate-400">{caption}</p>}
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rg-icon-btn h-8 w-8 shrink-0"
                  aria-label="Close full-size photograph"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-2 sm:p-4">
                <div className="relative inline-block max-w-full">
                  <img
                    src={resolvedImage}
                    alt={alt}
                    className="block max-h-[78vh] max-w-full object-contain"
                  />
                  <DetectionOverlay boxes={boxes} imageWidth={imageWidth} imageHeight={imageHeight} />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
