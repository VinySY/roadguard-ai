import React, { useState, useEffect, useRef } from 'react';
import { RoadIssue, DetectionResult, LocationCoordinates, Municipality, User } from '../../types';
import { storage } from '../../services/storage';
import { matchMunicipality, sendMunicipalEmailDispatch, DispatchReceipt } from '../../services/municipality';
import { getCurrentBrowserLocation } from '../../services/location';
import { detectPotholesInImage, detectPotholesInVideo } from '../../services/detection';
import { isVideoDetection } from '../../services/annotations';
import {
  persistEvidenceSource,
  persistEvidenceVideoSource,
  resolveMediaUrl,
  storedMediaPathFromUrl,
} from '../../services/media';
import { createRoadIssue } from '../../services/api';
import { CameraCapture } from '../detection/CameraCapture';
import { EvidenceInputGrid } from '../detection/EvidenceInputGrid';
import { LocationPinPicker } from '../map/LocationPinPicker';
import { EvidenceImage } from '../common/EvidenceImage';
import { DetectionMedia } from '../common/DetectionMedia';
import {
  X,
  MapPin,
  Crosshair,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Send,
  RefreshCw,
} from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onReportSubmitted: (newIssue: RoadIssue) => void;
  initialDetection?: DetectionResult | null;
  userCurrentLocation?: LocationCoordinates | null;
  initialMode?: 'upload-image' | 'take-photo' | 'upload-video' | 'record-video';
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onReportSubmitted,
  initialDetection,
  userCurrentLocation,
  initialMode = 'upload-image',
}) => {
  const [step, setStep] = useState<'evidence' | 'analysis' | 'location' | 'municipality' | 'confirmation'>(
    initialDetection ? 'location' : 'evidence'
  );

  // Evidence state
  const [evidenceType, setEvidenceType] = useState<'image' | 'video'>('image');
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(
    initialDetection?.imageUrl || null
  );
  const [evidenceBlob, setEvidenceBlob] = useState<Blob | null>(null);

  // Active camera mode if user chooses camera inside modal
  const [activeCameraMode, setActiveCameraMode] = useState<'photo' | 'video' | null>(
    initialMode === 'take-photo' ? 'photo' : initialMode === 'record-video' ? 'video' : null
  );

  // Analysis / Detection state
  const [detection, setDetection] = useState<DetectionResult | null>(initialDetection || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const reportVideoRef = useRef<HTMLVideoElement>(null);

  // Location state
  const [location, setLocation] = useState<LocationCoordinates>(
    userCurrentLocation || {
      lat: 30.7398,
      lng: 76.7827,
      street: 'Jan Marg, Sector 17',
      area: 'Sector 17',
      city: 'Chandigarh',
      postalCode: '160017',
    }
  );
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [customStreet, setCustomStreet] = useState(location.street || '');
  const [customArea, setCustomArea] = useState(location.area || '');
  const [isPinPickerOpen, setIsPinPickerOpen] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(true);
  const [submissionWarning, setSubmissionWarning] = useState<string | null>(null);

  // Municipal Dispatch state
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality>(
    matchMunicipality(location.lat, location.lng, location.area)
  );
  const [customDescription, setCustomDescription] = useState('');
  const [guestName, setGuestName] = useState(currentUser?.name || '');
  const [guestContact, setGuestContact] = useState(currentUser?.email || '');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState<DispatchReceipt | null>(null);
  const [createdIssue, setCreatedIssue] = useState<RoadIssue | null>(null);

  // Sync municipality when location updates
  useEffect(() => {
    const matched = matchMunicipality(location.lat, location.lng, location.area);
    setSelectedMunicipality(matched);
  }, [location]);

  // Reset/sync modal state whenever opened
  useEffect(() => {
    if (isOpen) {
      setAnalysisError(null);
      setSubmissionWarning(null);
      setIsPinPickerOpen(false);
      if (initialDetection) {
        const videoDetection = isVideoDetection(initialDetection);
        setStep('location');
        setDetection(initialDetection);
        setEvidenceType(videoDetection ? 'video' : 'image');
        setEvidenceUrl(
          initialDetection.imageUrl ||
            initialDetection.video?.url ||
            initialDetection.videoUrl ||
            null
        );
        setEvidenceBlob(null);
        setActiveCameraMode(null);
      } else {
        setStep('evidence');
        setDetection(null);
        setEvidenceUrl(null);
        setEvidenceBlob(null);
        if (initialMode === 'take-photo') {
          setActiveCameraMode('photo');
        } else if (initialMode === 'record-video') {
          setActiveCameraMode('video');
        } else {
          setActiveCameraMode(null);
        }
      }
    }
  }, [isOpen, initialMode, initialDetection]);

  // Close on Escape, except while a dispatch is in flight or the map picker is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDispatching && !isPinPickerOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isDispatching, isPinPickerOpen, onClose]);

  if (!isOpen) return null;

  const handleUseCurrentLocation = async () => {
    setIsDetectingLocation(true);
    const result = await getCurrentBrowserLocation();
    setIsDetectingLocation(false);
    if (result.status === 'granted' && result.coords) {
      setLocation(result.coords);
      setCustomStreet(result.coords.street || '');
      setCustomArea(result.coords.area || '');
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEvidenceUrl(url);
      setEvidenceBlob(file);
      setEvidenceType('image');
      setActiveCameraMode(null);
    }
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEvidenceUrl(url);
      setEvidenceBlob(file);
      setEvidenceType('video');
      setActiveCameraMode(null);
    }
  };

  const handleCameraCaptureEvidence = (evidence: { type: 'image' | 'video'; blob: Blob; previewUrl: string }) => {
    setEvidenceType(evidence.type);
    setEvidenceUrl(evidence.previewUrl);
    setEvidenceBlob(evidence.blob);
    setActiveCameraMode(null);
  };

  const handleStartAnalysis = async () => {
    const target = evidenceBlob || evidenceUrl;
    if (!target) return;

    setStep('analysis');
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      if (evidenceType === 'video') {
        const res = await detectPotholesInVideo(target);
        setDetection(res);
      } else {
        const res = await detectPotholesInImage(target);
        setDetection(res);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Detection analysis could not be completed. Please check the backend connection and try again.';
      console.error('Detection analysis error', err);
      setAnalysisError(message);
      setDetection(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePinConfirm = (coords: LocationCoordinates) => {
    setLocation(coords);
    setCustomStreet(coords.street || `Pinned ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    setCustomArea(coords.area || 'Selected on map');
    setShowManualLocation(true);
    setIsPinPickerOpen(false);
  };

  const handleSubmitReport = async () => {
    setIsDispatching(true);
    setSubmissionWarning(null);

    const refNum = `RG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalLocation: LocationCoordinates = {
      ...location,
      street: customStreet || location.street,
      area: customArea || location.area,
    };

    const newIssue: RoadIssue = {
      id: 'issue-' + Date.now(),
      referenceNumber: refNum,
      title: detection
        ? `${detection.potholeCount} ${detection.potholeCount === 1 ? 'Pothole' : 'Potholes'} on ${finalLocation.street || 'Roadway'}`
        : `Road Pothole on ${finalLocation.street || 'Roadway'}`,
      description: customDescription || 'Hazardous road cavity reported by citizen for urgent municipal repair.',
      severity: detection?.severity || 'high',
      status: 'notified_municipality',
      location: finalLocation,
      municipalityId: selectedMunicipality.id,
      municipalityName: selectedMunicipality.name,
      reportedBy: {
        userId: currentUser?.id,
        name: currentUser?.name || guestName || 'Citizen',
        contactEmail: currentUser?.email || guestContact,
        isGuest: !currentUser,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mediaType: evidenceType,
      evidenceImageUrl: evidenceType === 'image' ? resolveMediaUrl(evidenceUrl) || '' : '',
      evidenceVideoUrl: evidenceType === 'video' && evidenceUrl ? evidenceUrl : undefined,
      evidenceVideoPath: evidenceType === 'video' ? detection?.video?.path : undefined,
      detectionData: detection || undefined,
      priorityScore: detection?.severity === 'critical' ? 95 : detection?.severity === 'high' ? 82 : 60,
      timeline: [
        {
          id: 'tl-' + Date.now(),
          status: 'reported',
          title: 'Report Submitted',
          timestamp: 'Just now',
          description: `Report filed with ${evidenceType} evidence and GPS coordinates.`,
          actor: currentUser?.name || guestName || 'Citizen',
        },
        {
          id: 'tl-' + (Date.now() + 1),
          status: 'notified_municipality',
          title: 'Municipality Notified',
          timestamp: 'Just now',
          description: `Dispatched to ${selectedMunicipality.name} (${selectedMunicipality.department}).`,
          actor: 'RoadGuard Dispatch Engine',
        },
      ],
    };

    try {
      // Persist media before writing the local report so the evidence survives
      // refresh. Detection already stores its source file, so prefer that
      // durable copy instead of uploading the same payload twice.
      let durableImagePath: string | null = null;
      let durableVideoUrl: string | undefined;
      let durableVideoPath: string | undefined;

      if (evidenceType === 'video') {
        const serverVideoUrl = detection?.video?.url || detection?.videoUrl;
        const serverVideoPath = detection?.video?.path;
        if (serverVideoUrl && storedMediaPathFromUrl(serverVideoUrl)) {
          durableVideoUrl = resolveMediaUrl(serverVideoUrl) || serverVideoUrl;
          durableVideoPath = serverVideoPath || storedMediaPathFromUrl(serverVideoUrl);
        }

        if (!durableVideoUrl && (evidenceBlob || evidenceUrl)) {
          const persisted = await persistEvidenceVideoSource(
            evidenceBlob || evidenceUrl,
            evidenceBlob instanceof File ? evidenceBlob.name : 'complaint-video.webm'
          );
          if (persisted) {
            durableVideoUrl = persisted.url;
            durableVideoPath = persisted.path;
          }
        }

        if (durableVideoUrl) {
          newIssue.evidenceVideoUrl = durableVideoUrl;
          newIssue.evidenceVideoPath = durableVideoPath;
        } else {
          setSubmissionWarning(
            'The video could not be stored on the server, so playback may be unavailable after a refresh. The report and its detection results were still saved.'
          );
        }
      } else if (evidenceType === 'image') {
        const serverImageUrl = detection?.imageUrl;
        if (serverImageUrl && storedMediaPathFromUrl(serverImageUrl)) {
          newIssue.evidenceImageUrl = resolveMediaUrl(serverImageUrl) || serverImageUrl;
          durableImagePath = storedMediaPathFromUrl(serverImageUrl) || null;
        } else if (evidenceBlob || evidenceUrl) {
          try {
            const persisted = await persistEvidenceSource(
              evidenceBlob || evidenceUrl,
              evidenceBlob instanceof File ? evidenceBlob.name : 'complaint.jpg'
            );
            if (persisted) {
              newIssue.evidenceImageUrl = persisted;
              durableImagePath = storedMediaPathFromUrl(persisted) || null;
            }
          } catch (evidenceError) {
            console.warn('Evidence persistence failed; keeping the available preview.', evidenceError);
          }
        }
      }

      // Mirror the report into the existing MySQL-backed API. A backend or DB
      // outage must not block the citizen's local submission.
      try {
        const created = await createRoadIssue({
          category: 'Pothole',
          description: newIssue.description || '',
          severity: newIssue.severity,
          status: 'Reported',
          latitude: finalLocation.lat,
          longitude: finalLocation.lng,
          media_type: evidenceType,
          evidence_path: durableImagePath,
          evidence_video_path: durableVideoPath || null,
          detection_metadata: detection || undefined,
          evidenceFile:
            evidenceType === 'image' && evidenceBlob && !durableImagePath
              ? evidenceBlob
              : null,
        });
        const backendEvidenceUrl = resolveMediaUrl(created.evidence_url);
        if (backendEvidenceUrl) newIssue.evidenceImageUrl = backendEvidenceUrl;
        const backendVideoUrl = resolveMediaUrl(created.evidence_video_url);
        if (backendVideoUrl) newIssue.evidenceVideoUrl = backendVideoUrl;
        if (created.media_type === 'video' || created.media_type === 'image') {
          newIssue.mediaType = created.media_type;
        }
      } catch (apiError) {
        console.warn('Report saved locally; backend persistence unavailable.', apiError);
        setSubmissionWarning(
          'Saved on this device. The municipal database was not reachable, so server-side sync will need to be retried.'
        );
      }

      storage.saveIssue(newIssue);

      // Send demo municipal email dispatch
      const receipt = await sendMunicipalEmailDispatch(newIssue, selectedMunicipality);

      setDispatchReceipt(receipt);
      setCreatedIssue(newIssue);
      setStep('confirmation');
      onReportSubmitted(newIssue);
    } catch (error) {
      console.error('Report submission failed', error);
      setSubmissionWarning(
        'The report could not be completed. Please check your connection and try again.'
      );
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm rg-animate-fade">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 font-bold text-amber-400">
              RG
            </div>
            <div>
              <h3 id="report-modal-title" className="text-base font-semibold text-slate-100">
                Report a road problem
              </h3>
              <p className="text-xs text-slate-400">Step-by-step citizen road defect submission</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rg-icon-btn"
            aria-label="Close report dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-1.5 ${step === 'evidence' ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
            <span>Evidence</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-800"></div>
          <div className={`flex items-center gap-1.5 ${step === 'analysis' ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
            <span>AI Detection</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-800"></div>
          <div className={`flex items-center gap-1.5 ${step === 'location' ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
            <span>Location</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-800"></div>
          <div className={`flex items-center gap-1.5 ${step === 'municipality' ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">4</span>
            <span>Municipality</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* STEP 1: EVIDENCE (All 4 Choices Supported!) */}
          {step === 'evidence' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">1. Provide Road Surface Evidence</h4>
                <p className="text-xs text-slate-400">
                  Choose how you want to provide evidence: upload an image or video from your device, or use your live camera.
                </p>
              </div>

              {/* If user clicked Take Photo or Record Video, show inline camera */}
              {activeCameraMode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">
                      {activeCameraMode === 'photo' ? 'Live Camera: Take Photo' : 'Live Camera: Record Video'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCameraMode(null)}
                      className="text-slate-400 hover:text-slate-200 underline"
                    >
                      Choose another input method
                    </button>
                  </div>
                  <CameraCapture
                    initialMode={activeCameraMode}
                    onCaptureEvidence={handleCameraCaptureEvidence}
                    onCancel={() => setActiveCameraMode(null)}
                  />
                </div>
              ) : evidenceUrl ? (
                /* Preview of selected/captured evidence */
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                    {evidenceType === 'image' ? (
                      <EvidenceImage
                        src={evidenceUrl}
                        alt="Road distress evidence preview"
                        className="h-full w-full"
                        imgClassName="w-full h-full object-contain"
                        allowFullView
                      />
                    ) : (
                      <video
                        src={evidenceUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    )}

                    <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[11px] text-amber-400 font-mono border border-slate-800">
                      {evidenceType === 'image' ? 'Photo Evidence' : 'Video Footage'}
                    </div>
                  </div>

                  {/* Reset/Change evidence row */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400">Ready for automated road hazard assessment.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEvidenceUrl(null);
                        setEvidenceBlob(null);
                      }}
                      className="flex items-center gap-1 text-amber-400 hover:underline font-medium"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Change Evidence</span>
                    </button>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleStartAnalysis}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-md transition-colors"
                    >
                      <span>Continue to AI Analysis</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* The 4 Clear Evidence Input Choices in clean symmetrical 2x2 grid */
                <div className="space-y-4 pt-1">
                  <EvidenceInputGrid
                    onSelectMethod={(method) => {
                      if (method === 'take-photo') {
                        setActiveCameraMode('photo');
                      } else if (method === 'record-video') {
                        setActiveCameraMode('video');
                      }
                    }}
                    onImageFileSelect={(file) => {
                      const url = URL.createObjectURL(file);
                      setEvidenceUrl(url);
                      setEvidenceBlob(file);
                      setEvidenceType('image');
                      setActiveCameraMode(null);
                    }}
                    onVideoFileSelect={(file) => {
                      const url = URL.createObjectURL(file);
                      setEvidenceUrl(url);
                      setEvidenceBlob(file);
                      setEvidenceType('video');
                      setActiveCameraMode(null);
                    }}
                  />

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Formats supported: JPG, PNG photos &amp; MP4, WebM dashcam video.</span>
                    <span className="font-mono text-amber-500/80 text-[10px]">AI Optical Scan</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ANALYSIS */}
          {step === 'analysis' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">2. RoadGuard AI Optical Assessment</h4>
                <p className="text-xs text-slate-400">
                  Automated pothole detection and risk classification for municipal priority.
                </p>
              </div>

              {isAnalyzing ? (
                <div className="p-12 rounded-xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                  <h5 className="text-sm font-semibold text-slate-200">
                    {evidenceType === 'video' ? 'Analyzing Road Video Stream with Roboflow...' : 'Analyzing Road Surface with Roboflow...'}
                  </h5>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Executing YOLOv11 segmentation & localizing roadway distress coordinates
                  </p>
                </div>
              ) : analysisError ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
                  <AlertTriangle className="mb-3 h-8 w-8 text-rose-400" aria-hidden="true" />
                  <h5 className="text-sm font-semibold text-slate-100">AI analysis could not complete</h5>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">{analysisError}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartAnalysis}
                      className="rg-btn rg-btn-primary"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Retry analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('evidence')}
                      className="rg-btn rg-btn-secondary"
                    >
                      Change evidence
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">
                    The photo was kept. You can still submit the report without AI severity if needed.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep('location')}
                    className="mt-1 text-[11px] font-medium text-amber-400 hover:text-amber-300"
                  >
                    Continue without AI assessment →
                  </button>
                </div>
              ) : detection ? (
                <div className="space-y-3">
                  {/* Visual Evidence Preview with Bounding Box & Polygon Overlay */}
                  <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2 sm:p-3 flex items-center justify-center min-h-[220px]">
                    <div className="relative inline-block max-w-full">
                      {evidenceType === 'video' ? (
                        <video
                          ref={reportVideoRef}
                          src={evidenceUrl || detection.videoUrl || undefined}
                          className="max-h-[300px] max-w-full w-auto h-auto block rounded-lg mx-auto shadow-md"
                          onTimeUpdate={(e) => setVideoCurrentTime((e.target as HTMLVideoElement).currentTime)}
                          onSeeked={(e) => setVideoCurrentTime((e.target as HTMLVideoElement).currentTime)}
                          controls
                          playsInline
                        />
                      ) : (
                        resolveMediaUrl(evidenceUrl || detection.imageUrl) ? (
                          <img
                            src={resolveMediaUrl(evidenceUrl || detection.imageUrl) || undefined}
                            alt="Road incident evidence"
                            className="max-h-[300px] max-w-full w-auto h-auto block rounded-lg mx-auto shadow-md"
                          />
                        ) : (
                          <div className="flex h-48 w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-6 text-center text-xs text-slate-500">
                            The evidence preview is unavailable, but the detection results below are preserved.
                          </div>
                        )
                      )}

                      {/* Overlays */}
                      {(() => {
                        let boxesToRender: typeof detection.boxes = detection.boxes || [];
                        if (evidenceType === 'video' && detection.videoFrames && detection.videoFrames.length > 0) {
                          let closest = detection.videoFrames[0];
                          let minDiff = Infinity;
                          for (const f of detection.videoFrames) {
                            const diff = Math.abs(f.timestamp - videoCurrentTime);
                            if (diff < minDiff) {
                              minDiff = diff;
                              closest = f;
                            }
                          }
                          if (closest && minDiff <= 1.2 && closest.boxes.length > 0) {
                            boxesToRender = closest.boxes;
                          }
                        }

                        if (boxesToRender.length === 0) return null;

                        return (
                          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
                            {/* SVG Polygons */}
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              viewBox={`0 0 ${detection.image?.width || 640} ${detection.image?.height || (evidenceType === 'video' ? 360 : 640)}`}
                              preserveAspectRatio="none"
                            >
                              {boxesToRender.map((box, index) => {
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
                                    key={`rep-poly-${box.id || index}`}
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
                            {boxesToRender.map((box, index) => {
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
                                  key={`rep-box-${box.id || index}`}
                                  style={{
                                    position: 'absolute',
                                    left,
                                    top,
                                    width,
                                    height,
                                  }}
                                  className={`border-2 ${colorTheme.border} ${colorTheme.bg} rounded shadow-sm`}
                                >
                                  <span className={`absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 ${colorTheme.corner}`} />
                                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 ${colorTheme.corner}`} />
                                  <span className={`absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 ${colorTheme.corner}`} />
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 ${colorTheme.corner}`} />

                                  <div
                                    className={`absolute -top-5 left-0 ${colorTheme.badge} text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10`}
                                  >
                                    #{index + 1} {box.class} {Math.round(box.confidence * 100)}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        {detection.potholeCount > 0 ? (
                          <>
                            <span
                              className={`w-3 h-3 rounded-full ${
                                detection.severity === 'critical'
                                  ? 'bg-rose-500'
                                  : detection.severity === 'high'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            ></span>
                            <h5 className="text-sm font-semibold text-slate-100">
                              RoadGuard detected{' '}
                              <span className="text-amber-400 font-mono tabular-nums">
                                {detection.potholeCount}
                              </span>{' '}
                              {detection.potholeCount === 1 ? 'pothole' : 'potholes'}.
                            </h5>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <h5 className="text-sm font-semibold text-emerald-400">
                              No Potholes Detected — Road Surface Clear
                            </h5>
                          </>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-300">
                        Severity:{' '}
                        <strong className="capitalize text-amber-400">
                          {detection.potholeCount === 0 ? 'Clear' : detection.severity}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Municipal Action</span>
                        <span className="text-slate-200 font-medium truncate">
                          {detection.recommendedAction || 'Field inspection required'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Pavement Quality</span>
                        <span className="text-slate-200 font-mono tabular-nums">
                          {detection.roadConditionIndex != null
                            ? `Index ${detection.roadConditionIndex}/100`
                            : 'Not computed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep('evidence')}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('location')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-md transition-colors"
                    >
                      <span>Confirm Location</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 3: LOCATION */}
          {step === 'location' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">3. Confirm Incident Location</h4>
                <p className="text-xs text-slate-400">
                  Ensure the address is accurate so the municipal repair crew can quickly locate the site.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Incident location</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualLocation((open) => !open)}
                      aria-expanded={showManualLocation}
                      className="rg-btn rg-btn-sm rg-btn-secondary"
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      Add Location
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPinPickerOpen(true)}
                      className="rg-btn rg-btn-sm rg-btn-secondary"
                    >
                      <Crosshair className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                      Pin on Map
                    </button>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={isDetectingLocation}
                      className="rg-btn rg-btn-sm rg-btn-ghost"
                    >
                      {isDetectingLocation ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isDetectingLocation ? 'Locating…' : 'Use GPS'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 font-mono text-[11px] text-slate-400">
                  <span className="text-amber-400">
                    {location.lat.toFixed(6)}°N, {location.lng.toFixed(6)}°E
                  </span>
                  <span className="truncate">{location.street || location.area || 'No street label'}</span>
                  {location.area === 'Selected on map' && <span className="rg-badge rg-badge-amber">Pinned</span>}
                </div>

                {showManualLocation && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label htmlFor="report-street" className="text-[11px] text-slate-400 block mb-1">Street / Roadway</label>
                      <input
                        id="report-street"
                        type="text"
                        value={customStreet}
                        onChange={(e) => setCustomStreet(e.target.value)}
                        placeholder="e.g. Jan Marg, Near Plaza"
                        className="rg-input"
                      />
                    </div>

                    <div>
                      <label htmlFor="report-area" className="text-[11px] text-slate-400 block mb-1">Area / Sector</label>
                      <input
                        id="report-area"
                        type="text"
                        value={customArea}
                        onChange={(e) => setCustomArea(e.target.value)}
                        placeholder="e.g. Sector 17, Chandigarh"
                        className="rg-input"
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 pt-1">
                      Use <span className="text-slate-300">Pin on Map</span> for an exact road position, or edit the address manually.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('analysis')}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('municipality')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-md transition-colors"
                >
                  <span>Verify Responsible Municipality</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: MUNICIPALITY DISPATCH */}
          {step === 'municipality' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">4. Report to Municipality</h4>
                <p className="text-xs text-slate-400">
                  Your report will be sent to the official agency responsible for road maintenance in this zone.
                </p>
              </div>

              {submissionWarning && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{submissionWarning}</span>
                </div>
              )}

              {/* Responsible Municipality Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-slate-100">
                        {selectedMunicipality.name}
                      </h5>
                      <p className="text-xs text-slate-400">{selectedMunicipality.department}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Dispatch Zone: {selectedMunicipality.dispatchZone}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                    SLA: {selectedMunicipality.slaHours}h Target
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between text-slate-300">
                  <span>Helpline: <strong className="text-slate-100 font-mono">{selectedMunicipality.helpline}</strong></span>
                  <span>Contact: <span className="font-mono text-slate-400">{selectedMunicipality.contactEmail}</span></span>
                </div>
              </div>

              {/* Evidence Review Summary */}
              {evidenceUrl && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="w-16 h-12 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-800 relative">
                    {evidenceType === 'video' ? (
                      <video src={evidenceUrl} className="w-full h-full object-cover" />
                    ) : (
                      <EvidenceImage
                        src={evidenceUrl}
                        alt="Evidence summary"
                        className="h-full w-full"
                        imgClassName="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-semibold text-slate-200 truncate">
                      {detection ? `${detection.potholeCount} ${detection.potholeCount === 1 ? 'Pothole' : 'Potholes'} Identified` : 'Evidence Attached'}
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize">
                      {evidenceType} inspection · Severity: <span className="text-amber-400 font-medium">{detection?.severity || 'Standard'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Citizen Contact (if guest) */}
              <div className="space-y-3">
                {!currentUser && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Your Name (Optional)</label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Citizen name"
                        className="rg-input !py-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Contact Email / Phone</label>
                      <input
                        type="text"
                        value={guestContact}
                        onChange={(e) => setGuestContact(e.target.value)}
                        placeholder="For status updates"
                        className="rg-input !py-1.5"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Description / Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="e.g. Near bus stop, sharp drop-off risking tires and two-wheelers."
                    className="rg-textarea resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('location')}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={isDispatching}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                  {isDispatching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Dispatch...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Report to Municipality</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRMATION & DISPATCH RECEIPT */}
          {step === 'confirmation' && createdIssue && (
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-100">Municipal Dispatch Confirmed</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Your road problem report has been officially logged with the municipal engineering cell.
                </p>
              </div>

              {/* Reference & SLA Ticket */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-md mx-auto text-left space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs text-slate-400">Reference Number</span>
                  <span className="text-sm font-mono font-bold text-amber-400 tabular-nums">
                    {createdIssue.referenceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Municipality</span>
                  <span className="text-slate-200 font-medium truncate max-w-[200px]">
                    {selectedMunicipality.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Inspection Window</span>
                  <span className="text-slate-200 font-mono">Under {selectedMunicipality.slaHours} Hours</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Location</span>
                  <span className="text-slate-200">
                    {createdIssue.location.street || createdIssue.location.area}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Demo Municipal Gateway: Simulated official dispatch email generated and queued for inspection crew.
              </p>

              {submissionWarning && (
                <div className="mx-auto flex max-w-md items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-[11px] text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{submissionWarning}</span>
                </div>
              )}

              {(createdIssue.evidenceImageUrl || createdIssue.evidenceVideoUrl) && (
                <div className="mx-auto max-w-md text-left">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-1.5">
                    <DetectionMedia
                      imageSrc={createdIssue.evidenceImageUrl}
                      videoSrc={createdIssue.evidenceVideoUrl}
                      detection={createdIssue.detectionData}
                      alt="Submitted road evidence"
                      maxHeightClassName="max-h-40"
                      allowFullView
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rg-btn rg-btn-secondary"
                >
                  Close &amp; view on dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LocationPinPicker
        isOpen={isPinPickerOpen}
        initialLocation={location}
        onConfirm={handlePinConfirm}
        onCancel={() => setIsPinPickerOpen(false)}
      />
    </div>
  );
};
