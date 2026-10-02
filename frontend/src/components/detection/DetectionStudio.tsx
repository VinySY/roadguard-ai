import React, { useState } from 'react';
import { ImageDetector } from './ImageDetector';
import { VideoDetector } from './VideoDetector';
import { CameraCapture } from './CameraCapture';
import { EvidenceInputGrid, EvidenceMethod } from './EvidenceInputGrid';
import { DetectionResult, UserRole } from '../../types';
import { RefreshCw } from 'lucide-react';

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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Studio Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <span>RoadGuard AI Detection Studio</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                Optical Inspection
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select any of the four evidence input methods below to analyze roadway distress and classify severity.
            </p>
          </div>
        </div>
      </div>

      {/* Symmetrical 2x2 Grid on Mobile, 4-Across on Desktop */}
      <EvidenceInputGrid
        activeMethod={activeMethod}
        onSelectMethod={handleSelectMethod}
        isActionOnly={true}
      />

      {/* Active Workspace Container */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        {/* 1. Upload Image Mode */}
        {activeMethod === 'upload-image' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-medium text-slate-200">
                {capturedPhotoUrl ? 'Analyzing Photo Captured from Camera' : 'Image Upload Detection'}
              </span>
              {capturedPhotoUrl && (
                <button
                  onClick={() => {
                    setCapturedPhotoUrl(null);
                    setActiveMethod('take-photo');
                  }}
                  className="flex items-center gap-1 text-amber-400 hover:underline font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake Photo</span>
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

        {/* 2. Take Photo with Camera Mode */}
        {activeMethod === 'take-photo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="font-medium text-slate-200">Take Photo with Device Camera</span>
              <span className="text-slate-400 font-mono text-[11px]">Live Camera Mode</span>
            </div>

            <CameraCapture
              initialMode="photo"
              onCaptureEvidence={handleCameraCapture}
              onCancel={() => setActiveMethod('upload-image')}
            />
          </div>
        )}

        {/* 3. Upload Video Mode */}
        {activeMethod === 'upload-video' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400">
              <span className="font-medium text-slate-200">
                {capturedVideo ? 'Analyzing Video Recorded from Camera' : 'Video Footage Detection'}
              </span>
              {capturedVideo && (
                <button
                  onClick={() => {
                    setCapturedVideo(null);
                    setActiveMethod('record-video');
                  }}
                  className="flex items-center gap-1 text-amber-400 hover:underline font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Record Again</span>
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

        {/* 4. Record Video with Camera Mode */}
        {activeMethod === 'record-video' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="font-medium text-slate-200">Record Video with Device Camera</span>
              <span className="text-slate-400 font-mono text-[11px]">MediaRecorder Mode</span>
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
