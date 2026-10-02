import React, { useState, useEffect } from 'react';
import { RoadIssue, DetectionResult, LocationCoordinates, Municipality, User } from '../../types';
import { storage } from '../../services/storage';
import { matchMunicipality, sendMunicipalEmailDispatch, DispatchReceipt } from '../../services/municipality';
import { getCurrentBrowserLocation } from '../../services/location';
import { detectPotholesInImage, detectPotholesInVideo } from '../../services/detection';
import { CameraCapture } from '../detection/CameraCapture';
import { EvidenceInputGrid } from '../detection/EvidenceInputGrid';
import {
  X,
  Camera,
  UploadCloud,
  MapPin,
  Crosshair,
  Building2,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Send,
  Video,
  Film,
  Image,
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
      if (initialDetection) {
        setStep('location');
        setDetection(initialDetection);
        setEvidenceUrl(initialDetection.imageUrl || null);
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

    try {
      if (evidenceType === 'video') {
        const res = await detectPotholesInVideo(target);
        setDetection(res);
      } else {
        const res = await detectPotholesInImage(target);
        setDetection(res);
      }
    } catch (err) {
      console.error('Detection analysis error', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitReport = async () => {
    setIsDispatching(true);

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
      evidenceImageUrl:
        evidenceType === 'image' && evidenceUrl
          ? evidenceUrl
          : detection?.imageUrl || '/src/assets/images/roadguard_pothole_evidence_1790958622590.jpg',
      evidenceVideoUrl: evidenceType === 'video' && evidenceUrl ? evidenceUrl : undefined,
      detectionData: detection || undefined,
      priorityScore: detection?.severity === 'critical' ? 95 : detection?.severity === 'high' ? 82 : 60,
      timeline: [
        {
          id: 'tl-' + Date.now(),
          status: 'reported',
          title: 'Report Submitted',
          timestamp: 'Just now',
          description: `Report filed with verified ${evidenceType} evidence and GPS coordinates.`,
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

    // Save to persistent storage
    storage.saveIssue(newIssue);

    // Send demo municipal email dispatch
    const receipt = await sendMunicipalEmailDispatch(newIssue, selectedMunicipality);

    setIsDispatching(false);
    setDispatchReceipt(receipt);
    setCreatedIssue(newIssue);
    setStep('confirmation');
    onReportSubmitted(newIssue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              RG
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Report a Road Problem</h3>
              <p className="text-xs text-slate-400">Step-by-step citizen road defect submission</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
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
                      <img
                        src={evidenceUrl}
                        alt="Road Distress Evidence"
                        className="w-full h-full object-contain"
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
                    {evidenceType === 'video' ? 'Analyzing Road Video Stream...' : 'Analyzing Road Surface...'}
                  </h5>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Scanning asphalt distress, depth contours, and pavement fissure margins
                  </p>
                </div>
              ) : detection ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
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
                      </div>
                      <span className="text-xs font-medium text-slate-300">
                        Severity:{' '}
                        <strong className="capitalize text-amber-400">
                          {detection.severity}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Municipal Action</span>
                        <span className="text-slate-200 font-medium">
                          {detection.recommendedAction || 'Field inspection required'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Pavement Quality</span>
                        <span className="text-slate-200 font-mono tabular-nums">
                          Index {detection.roadConditionIndex}/100
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setStep('evidence')}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Evidence
                    </button>
                    <button
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Current Selected Location</span>
                  </div>
                  <button
                    onClick={handleUseCurrentLocation}
                    disabled={isDetectingLocation}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    {isDetectingLocation ? 'Locating...' : 'Use My GPS Location'}
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Street / Roadway</label>
                    <input
                      type="text"
                      value={customStreet}
                      onChange={(e) => setCustomStreet(e.target.value)}
                      placeholder="e.g. Jan Marg, Near Plaza"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Area / Sector</label>
                    <input
                      type="text"
                      value={customArea}
                      onChange={(e) => setCustomArea(e.target.value)}
                      placeholder="e.g. Sector 17, Chandigarh"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 pt-1">
                    Coordinates: {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep('analysis')}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
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
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Contact Email / Phone</label>
                      <input
                        type="text"
                        value={guestContact}
                        onChange={(e) => setGuestContact(e.target.value)}
                        placeholder="For status updates"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep('location')}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
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

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  Close & View on Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
