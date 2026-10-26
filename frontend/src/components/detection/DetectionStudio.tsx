import React, { useState } from 'react';
import { ImageDetector } from './ImageDetector';
import { VideoDetector } from './VideoDetector';
import { CameraCapture } from './CameraCapture';
import { EvidenceInputGrid, EvidenceMethod } from './EvidenceInputGrid';
import { DetectionResult, UserRole } from '../../types';
import { RefreshCw, ScanSearch } from 'lucide-react';
import { PageHeader } from '../common/PageHeader';

interface DetectionStudioProps {
  role?: UserRole;
  onProceedToReport?: (result: DetectionResult) => void;
  onViewOnMap?: () => void;
  initialMethod?: EvidenceMethod;
}

export const DetectionStudio: React.FC<DetectionStudioProps> = ({
  role = 'citizen',
  onProceedToReport,
  onViewOnMap,
  initialMethod = 'upload-image',
}) => {
  const [activeMethod, setActiveMethod] = useState<EvidenceMethod>(initialMethod);

  // Staged evidence from camera capture to pass into detector
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<{ blob: Blob; url: string } | null>(null);

  const handleCameraCapture = (evidence: { type: 'image' | 'video'; blob: Blob; previewUrl: string }) => {
    if (evidence.type === 'image') {
      setCapturedPhotoUrl(evidence.previewUrl);
      setActiveMethod('upload-image');
    } else {
      setCapturedVideo({ blob: evidence.blob, url: evidence.previewUrl });
      setActiveMethod('upload-video');
    }
  };

  const handleSelectMethod = (method: EvidenceMethod) => {
    setActiveMethod(method);
    if (method === 'take-photo') {
      setCapturedPhotoUrl(null);
    }
    if (method === 'record-video') {
      setCapturedVideo(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        eyebrow={
          <>
            <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
            AI detection studio
          </>
        }
        icon={<ScanSearch className="h-4 w-4" aria-hidden="true" />}
        title="Road distress detection"
        description="Capture or upload evidence, run segmentation inference, then carry the verified findings straight into a road report."
        actions={
          <span className="rg-badge rg-badge-amber">Roboflow segmentation</span>
        }
      />

      <EvidenceInputGrid
        activeMethod={activeMethod}
        onSelectMethod={handleSelectMethod}
        isActionOnly
      />

      {/* Active workspace */}
      <div className="rg-panel rounded-2xl p-4 sm:p-6">
        {activeMethod === 'upload-image' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 pb-3 text-xs text-slate-400">
              <span className="font-medium text-slate-200">
                {capturedPhotoUrl ? 'Analyzing photo captured from camera' : 'Image upload detection'}
              </span>
              {capturedPhotoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhotoUrl(null);
                    setActiveMethod('take-photo');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-amber-400 hover:text-amber-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retake photo
                </button>
              )}
            </div>

            <ImageDetector
              role={role}
              initialImage={capturedPhotoUrl || undefined}
              onProceedToReport={onProceedToReport}
            />
          </div>
        )}

        {activeMethod === 'take-photo' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 pb-3 text-xs">
              <span className="font-medium text-slate-200">Take photo with device camera</span>
              <span className="font-mono text-[11px] text-slate-400">Live camera</span>
            </div>

            <CameraCapture
              initialMode="photo"
              onCaptureEvidence={handleCameraCapture}
              onCancel={() => setActiveMethod('upload-image')}
            />
          </div>
        )}

        {activeMethod === 'upload-video' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 pb-3 text-xs text-slate-400">
              <span className="font-medium text-slate-200">
                {capturedVideo ? 'Analyzing video recorded from camera' : 'Video footage detection'}
              </span>
              {capturedVideo && (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedVideo(null);
                    setActiveMethod('record-video');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-amber-400 hover:text-amber-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Record again
                </button>
              )}
            </div>

            <VideoDetector
              role={role}
              initialVideo={capturedVideo}
              onProceedToReport={onProceedToReport}
              onViewOnMap={onViewOnMap}
            />
          </div>
        )}

        {activeMethod === 'record-video' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 pb-3 text-xs">
              <span className="font-medium text-slate-200">Record video with device camera</span>
              <span className="font-mono text-[11px] text-slate-400">MediaRecorder</span>
            </div>

            <CameraCapture
              initialMode="video"
              onCaptureEvidence={handleCameraCapture}
              onCancel={() => setActiveMethod('upload-video')}
            />
          </div>
        )}
      </div>
    </div>
  );
};
