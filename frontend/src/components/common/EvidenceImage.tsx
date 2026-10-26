import React, { useCallback, useEffect, useState } from 'react';
import { ImageOff, Loader2, Maximize2, X } from 'lucide-react';
import { resolveMediaUrl } from '../../services/media';

interface EvidenceImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Opens an accessible full-size lightbox when the evidence loads. */
  allowFullView?: boolean;
  caption?: string;
}

export const EvidenceImage: React.FC<EvidenceImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  allowFullView = false,
  caption,
}) => {
  const resolved = resolveMediaUrl(src);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(resolved ? 'loading' : 'error');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    setStatus(resolved ? 'loading' : 'error');
    setIsPreviewOpen(false);
  }, [resolved]);

  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPreviewOpen, closePreview]);

  if (!resolved || status === 'error') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 border px-3 py-6 text-center ${className}`}
        style={{ background: 'var(--rg-bg-deep)', borderColor: 'var(--rg-border-soft)' }}
        role="img"
        aria-label="Photographic evidence could not be loaded"
      >
        <ImageOff className="h-6 w-6 text-slate-500" aria-hidden="true" />
        <span className="text-xs font-medium text-slate-300">Photograph unavailable</span>
        <span className="max-w-[240px] text-[11px] leading-relaxed text-slate-500">
          This report's pothole photo could not be loaded. The file may be missing or its saved path is no longer valid.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={`relative overflow-hidden ${className}`} style={{ background: 'var(--rg-bg-deep)' }}>
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-slate-950/70 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden="true" />
            <span className="text-[11px] font-medium">Loading photograph…</span>
          </div>
        )}
        <img
          src={resolved}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={imgClassName}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
        {allowFullView && status === 'loaded' && (
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="absolute bottom-2 right-2 flex min-h-8 items-center gap-1 rounded-lg border border-slate-600/60 bg-slate-950/85 px-2 py-1 text-[11px] font-medium text-slate-100 opacity-90 backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100"
            aria-label={`View full-size photograph: ${alt}`}
          >
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
            View
          </button>
        )}
      </div>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Full-size photographic evidence"
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
              <img
                src={resolved}
                alt={alt}
                className="max-h-[78vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
