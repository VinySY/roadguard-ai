import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Video,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FlipHorizontal,
  StopCircle,
  Circle,
  Clock,
  Smartphone,
  HelpCircle,
  Info,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CameraMode = 'photo' | 'video';

interface CameraCaptureProps {
  /** Mode to open in */
  defaultMode?: CameraMode;
  /** Called when user confirms a captured photo File */
  onPhotoCapture: (file: File, previewUrl: string) => void;
  /** Called when user confirms a recorded video File */
  onVideoCapture: (file: File, previewUrl: string) => void;
  /** Called to close/cancel the modal */
  onClose: () => void;
}

// Permission states
type PermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable' | 'loading' | 'native-mode';

// Camera phase
type CameraPhase =
  | 'requesting'   // asking for permission / starting stream
  | 'live'         // showing live preview
  | 'captured'     // photo taken, waiting for user action
  | 'recorded'     // video recorded, waiting for user action
  | 'recording'    // actively recording
  | 'native';      // native HTML media capture fallback (HTTP / LAN mode)

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Dynamically select best MediaRecorder MIME type */
function getBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

/** Format elapsed seconds as MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Derive file extension from MIME type */
function extFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  defaultMode = 'photo',
  onPhotoCapture,
  onVideoCapture,
  onClose,
}) => {
  // ── Mode ──────────────────────────────────────────────────
  const [mode, setMode] = useState<CameraMode>(defaultMode);

  // ── Camera / permission state ─────────────────────────────
  const [permissionState, setPermissionState] = useState<PermissionState>('loading');
  const [phase, setPhase] = useState<CameraPhase>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Device enumeration ────────────────────────────────────
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);

  // ── Stream & refs ─────────────────────────────────────────
  const streamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Native file inputs for HTTP / mobile fallback ──────────
  const nativePhotoInputRef = useRef<HTMLInputElement>(null);
  const nativeVideoInputRef = useRef<HTMLInputElement>(null);

  // ── Captured artefacts ────────────────────────────────────
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedPhotoBlob, setCapturedPhotoBlob] = useState<Blob | File | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | File | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('video/webm');

  // ── Recording timer ───────────────────────────────────────
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Artefact URL refs for cleanup ─────────────────────────
  const photoUrlRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────
  // Cleanup helpers
  // ─────────────────────────────────────────────────────────

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore if already stopped
      }
    }
    mediaRecorderRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokePhotoUrl = useCallback(() => {
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
  }, []);

  const revokeVideoUrl = useCallback(() => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
  }, []);

  // Full component cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      stopRecorder();
      stopTimer();
      revokePhotoUrl();
      revokeVideoUrl();
    };
  }, [stopStream, stopRecorder, stopTimer, revokePhotoUrl, revokeVideoUrl]);

  // ─────────────────────────────────────────────────────────
  // Start camera stream
  // ─────────────────────────────────────────────────────────

  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const startStream = useCallback(
    async (deviceId?: string) => {
      setPhase('requesting');
      setErrorMessage(null);

      // Stop any running stream first
      stopStream();

      // Check if getUserMedia is physically supported in this browser context.
      // Modern browsers (Chrome, Edge, Brave, Safari) block getUserMedia over non-secure HTTP (e.g. 10.200.50.197:3000)
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionState('native-mode');
        setPhase('native');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' }, // rear camera preferred for road capture
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: mode === 'video',
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setPermissionState('granted');

        // Attach to video element
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
        }

        // Enumerate devices once permission is granted
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          setVideoDevices(cams);

          // Track the active device
          const track = stream.getVideoTracks()[0];
          if (track) {
            const settings = track.getSettings();
            setActiveDeviceId(settings.deviceId ?? deviceId);
          }
        } catch {
          // Device enumeration optional
        }

        setPhase('live');
      } catch (err: unknown) {
        const e = err as DOMException;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setPermissionState('denied');
          setErrorMessage(
            'In-browser camera stream permission was denied. You can use your device native camera below.'
          );
        } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
          setPermissionState('native-mode');
          setPhase('native');
        } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
          setPermissionState('unavailable');
          setErrorMessage(
            'The camera is currently in use by another application. Please close other camera apps or use the native camera below.'
          );
        } else {
          setPermissionState('native-mode');
          setPhase('native');
        }
      }
    },
    [mode, stopStream]
  );

  // Start stream on mount
  useEffect(() => {
    startStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-attach video element after ref becomes available
  useEffect(() => {
    if (phase === 'live' && liveVideoRef.current && streamRef.current) {
      if (liveVideoRef.current.srcObject !== streamRef.current) {
        liveVideoRef.current.srcObject = streamRef.current;
      }
    }
  }, [phase]);

  // When mode changes: restart stream with audio toggle, reset artefacts
  const handleModeSwitch = useCallback(
    async (newMode: CameraMode) => {
      if (newMode === mode) return;

      // Stop any active recording before mode change
      stopRecorder();
      stopTimer();
      setRecordingSeconds(0);

      // Clean up any captured photo/video
      revokePhotoUrl();
      revokeVideoUrl();
      setCapturedPhotoUrl(null);
      setCapturedPhotoBlob(null);
      setRecordedVideoUrl(null);
      setRecordedVideoBlob(null);

      setMode(newMode);

      if (hasMediaDevices) {
        await startStream(activeDeviceId);
      } else {
        setPhase('native');
      }
    },
    [mode, activeDeviceId, hasMediaDevices, startStream, stopRecorder, stopTimer, revokePhotoUrl, revokeVideoUrl]
  );

  // Switch between available cameras (front / rear / external)
  const handleSwitchCamera = useCallback(async () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    if (nextDevice) {
      await startStream(nextDevice.deviceId);
    }
  }, [videoDevices, activeDeviceId, startStream]);

  // ─────────────────────────────────────────────────────────
  // Native File Capture Handlers (HTTP / Mobile / Fallback)
  // ─────────────────────────────────────────────────────────

  const handleNativePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    revokePhotoUrl();
    const url = URL.createObjectURL(file);
    photoUrlRef.current = url;
    setCapturedPhotoUrl(url);
    setCapturedPhotoBlob(file);
    setPhase('captured');
    e.target.value = '';
  };

  const handleNativeVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    revokeVideoUrl();
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setRecordedVideoUrl(url);
    setRecordedVideoBlob(file);
    setRecordedMimeType(file.type || 'video/mp4');
    setPhase('recorded');
    e.target.value = '';
  };

  // ─────────────────────────────────────────────────────────
  // In-browser Photo capture (via Live Canvas)
  // ─────────────────────────────────────────────────────────

  const handleTakePhoto = useCallback(() => {
    const video = liveVideoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        revokePhotoUrl();
        const url = URL.createObjectURL(blob);
        photoUrlRef.current = url;
        setCapturedPhotoUrl(url);
        setCapturedPhotoBlob(blob);
        setPhase('captured');
      },
      'image/jpeg',
      0.92
    );
  }, [revokePhotoUrl]);

  const handleRetakePhoto = useCallback(() => {
    revokePhotoUrl();
    setCapturedPhotoUrl(null);
    setCapturedPhotoBlob(null);

    if (streamRef.current && liveVideoRef.current) {
      setPhase('live');
      liveVideoRef.current.srcObject = streamRef.current;
    } else {
      setPhase('native');
      nativePhotoInputRef.current?.click();
    }
  }, [revokePhotoUrl]);

  const handleUsePhoto = useCallback(() => {
    if (!capturedPhotoBlob || !capturedPhotoUrl) return;

    const file =
      capturedPhotoBlob instanceof File
        ? capturedPhotoBlob
        : new File([capturedPhotoBlob], `roadguard-camera-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });

    onPhotoCapture(file, capturedPhotoUrl);
    // Caller owns the URL from here — do not revoke it
    photoUrlRef.current = null;
    onClose();
  }, [capturedPhotoBlob, capturedPhotoUrl, onPhotoCapture, onClose]);

  // ─────────────────────────────────────────────────────────
  // In-browser Video recording (via Live MediaRecorder)
  // ─────────────────────────────────────────────────────────

  const handleStartRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mime = getBestMimeType();
    setRecordedMimeType(mime);

    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(streamRef.current, { mimeType: mime })
        : new MediaRecorder(streamRef.current);
    } catch {
      setErrorMessage('MediaRecorder is not supported in this browser. Please use native camera below.');
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      stopTimer();
      const actualMime = recorder.mimeType || mime || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: actualMime });
      revokeVideoUrl();
      const url = URL.createObjectURL(blob);
      videoUrlRef.current = url;
      setRecordedVideoUrl(url);
      setRecordedVideoBlob(blob);
      setRecordedMimeType(actualMime);
      setPhase('recorded');
    };

    mediaRecorderRef.current = recorder;
    recorder.start(500); // collect data every 500ms

    setPhase('recording');
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  }, [stopTimer, revokeVideoUrl]);

  const handleStopRecording = useCallback(() => {
    stopTimer();
    stopRecorder();
  }, [stopTimer, stopRecorder]);

  const handleRecordAgain = useCallback(() => {
    revokeVideoUrl();
    setRecordedVideoUrl(null);
    setRecordedVideoBlob(null);
    setRecordingSeconds(0);

    if (streamRef.current && liveVideoRef.current) {
      setPhase('live');
      liveVideoRef.current.srcObject = streamRef.current;
    } else {
      setPhase('native');
      nativeVideoInputRef.current?.click();
    }
  }, [revokeVideoUrl]);

  const handleUseVideo = useCallback(() => {
    if (!recordedVideoBlob || !recordedVideoUrl) return;

    const ext = extFromMime(recordedMimeType);
    const file =
      recordedVideoBlob instanceof File
        ? recordedVideoBlob
        : new File([recordedVideoBlob], `roadguard-camera-${Date.now()}.${ext}`, {
            type: recordedMimeType || 'video/webm',
          });

    onVideoCapture(file, recordedVideoUrl);
    // Caller owns the URL
    videoUrlRef.current = null;
    onClose();
  }, [recordedVideoBlob, recordedVideoUrl, recordedMimeType, onVideoCapture, onClose]);

  // ─────────────────────────────────────────────────────────
  // Close with full cleanup
  // ─────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    stopRecorder();
    stopTimer();
    stopStream();
    revokePhotoUrl();
    revokeVideoUrl();
    onClose();
  }, [stopRecorder, stopTimer, stopStream, revokePhotoUrl, revokeVideoUrl, onClose]);

  // ─────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────

  const isLive = phase === 'live' || phase === 'recording';
  const showLivePreview = isLive && mode === 'photo';
  const showLiveForVideo = isLive && mode === 'video';

  // ─────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Camera Capture"
    >
      {/* Hidden native camera file inputs (Works 100% on HTTP and Mobile) */}
      <input
        ref={nativePhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativePhotoSelected}
        className="hidden"
        id="roadguard-native-photo-input"
        aria-hidden="true"
      />
      <input
        ref={nativeVideoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleNativeVideoSelected}
        className="hidden"
        id="roadguard-native-video-input"
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden max-h-[95vh]">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
              Camera Input
            </span>
            <h2 className="text-lg font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-400" />
              Capture Road Footage
            </h2>
          </div>

          <button
            onClick={handleClose}
            aria-label="Close camera"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Mode Selector ── */}
        <div className="flex gap-1 p-3 border-b border-slate-800 bg-slate-900/50">
          <button
            onClick={() => handleModeSwitch('photo')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              mode === 'photo'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            aria-pressed={mode === 'photo'}
          >
            <Camera className="w-4 h-4" />
            Photo
          </button>
          <button
            onClick={() => handleModeSwitch('video')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              mode === 'video'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            aria-pressed={mode === 'video'}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* === REQUESTING PERMISSION === */}
          {phase === 'requesting' && permissionState === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
              <p className="text-sm text-slate-300 font-medium">Connecting camera…</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Allowing camera access so RoadGuard can capture road footage.
              </p>
            </div>
          )}

          {/* === NATIVE CAMERA MODE (HTTP / LAN / Mobile fallback) === */}
          {(phase === 'native' || permissionState === 'native-mode') && (
            <div className="flex flex-col items-center justify-center gap-5 py-8 px-6 text-center">
              {/* Status Icon */}
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                {mode === 'photo' ? (
                  <Camera className="w-8 h-8" />
                ) : (
                  <Video className="w-8 h-8" />
                )}
              </div>

              {/* Status & Context */}
              <div className="space-y-2 max-w-md">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-[11px] font-mono font-semibold">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Device Camera Ready</span>
                </div>

                <h3 className="text-base font-bold text-white">
                  {mode === 'photo' ? 'Capture Road Photo with Camera' : 'Record Road Video with Camera'}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {mode === 'photo'
                    ? 'Use your phone or device camera to take an instant high-resolution asphalt capture for pothole detection.'
                    : 'Use your phone or device camera to record road inspection video for multi-frame pothole tracking.'}
                </p>

                {/* Network origin notice */}
                <div className="text-[11px] text-slate-500 font-mono bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 text-left space-y-1">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span>Origin: <code className="text-amber-400">{typeof window !== 'undefined' ? window.location.host : 'local network'}</code></span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Native camera capture operates directly on all local networks (HTTP &amp; HTTPS) with zero certificate requirements.
                  </p>
                </div>
              </div>

              {/* Primary Trigger Button */}
              <div className="w-full max-w-sm space-y-3">
                {mode === 'photo' ? (
                  <button
                    type="button"
                    onClick={() => nativePhotoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Open Camera &amp; Take Photo</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => nativeVideoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Video className="w-5 h-5" />
                    <span>Open Camera &amp; Record Video</span>
                  </button>
                )}

                {/* Tips collapsible */}
                <details className="text-left text-xs bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-slate-400 cursor-pointer">
                  <summary className="font-semibold text-slate-300 flex items-center gap-1.5 select-none hover:text-amber-400 transition-colors">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Want in-browser live viewfinder streaming?</span>
                  </summary>
                  <div className="mt-2.5 space-y-2 text-[11px] text-slate-400 font-mono pl-4 border-l border-slate-800">
                    <p>
                      WebRTC live streams are restricted by browsers on non-HTTPS network IPs (<code className="text-amber-400">{typeof window !== 'undefined' ? window.location.host : 'LAN'}</code>).
                    </p>
                    <p className="font-sans text-slate-300">
                      <strong>Option 1:</strong> Access from this computer at <code className="text-amber-400">http://localhost:3000</code>.
                    </p>
                    <p className="font-sans text-slate-300">
                      <strong>Option 2:</strong> In Chrome or Brave, open <code className="text-amber-400">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, add <code className="text-amber-400">http://{typeof window !== 'undefined' ? window.location.host : '10.200.50.197:3000'}</code>, set to Enabled, and relaunch browser.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* === PERMISSION DENIED OR ERROR FALLBACK === */}
          {permissionState === 'denied' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-bold text-white">Browser Camera Blocked</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Browser streaming was denied, but you can capture photos or videos using your system camera below.
                </p>
              </div>
              <div className="w-full max-w-sm pt-2">
                {mode === 'photo' ? (
                  <button
                    type="button"
                    onClick={() => nativePhotoInputRef.current?.click()}
                    className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo with Device Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => nativeVideoInputRef.current?.click()}
                    className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Record Video with Device Camera
                  </button>
                )}
              </div>
            </div>
          )}

          {/* === LIVE PREVIEW (Photo & Video mode) === */}
          {(showLivePreview || showLiveForVideo) && (
            <div className="relative bg-black">
              <video
                ref={liveVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-[55vh] object-contain block"
                aria-label="Live camera preview"
              />

              {/* Recording indicator overlay */}
              {phase === 'recording' && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 border border-red-500/60 text-red-400 rounded-full px-3 py-1.5 text-xs font-bold font-mono">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-label="Recording" />
                  REC {formatTime(recordingSeconds)}
                </div>
              )}

              {/* Camera switch button */}
              {videoDevices.length > 1 && phase !== 'recording' && (
                <button
                  onClick={handleSwitchCamera}
                  aria-label="Switch camera"
                  title={`Switch camera (${videoDevices.length} available)`}
                  className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 border border-slate-700/60 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <FlipHorizontal className="w-5 h-5" />
                </button>
              )}

              {/* Number of available cameras badge */}
              {videoDevices.length > 1 && (
                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-1 rounded-full">
                  {videoDevices.length} cameras
                </div>
              )}
            </div>
          )}

          {/* === PHOTO CAPTURED PREVIEW === */}
          {phase === 'captured' && capturedPhotoUrl && (
            <div className="relative bg-black">
              <img
                src={capturedPhotoUrl}
                alt="Captured road photo"
                className="w-full max-h-[55vh] object-contain block"
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 border border-emerald-500/60 text-emerald-400 rounded-full px-3 py-1.5 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Photo Captured
              </div>
            </div>
          )}

          {/* === VIDEO RECORDED PREVIEW === */}
          {phase === 'recorded' && recordedVideoUrl && (
            <div className="relative bg-black">
              <video
                src={recordedVideoUrl}
                controls
                playsInline
                className="w-full max-h-[55vh] object-contain block"
                aria-label="Recorded video preview"
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 border border-emerald-500/60 text-emerald-400 rounded-full px-3 py-1.5 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Recording Complete
              </div>
            </div>
          )}

          {/* Hidden canvas for live stream photo capture */}
          <canvas ref={captureCanvasRef} className="hidden" aria-hidden="true" />

          {/* ── Live Stream Capture Controls ── */}
          {(phase === 'live' || phase === 'recording') && !errorMessage && (
            <div className="px-5 py-4 border-t border-slate-800 space-y-3">
              {/* PHOTO mode controls */}
              {mode === 'photo' && phase === 'live' && (
                <div className="space-y-2">
                  <button
                    onClick={handleTakePhoto}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer"
                    aria-label="Take photo"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => nativePhotoInputRef.current?.click()}
                    className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Use Native System Camera Instead
                  </button>
                </div>
              )}

              {/* VIDEO mode controls */}
              {mode === 'video' && phase === 'live' && (
                <div className="space-y-2">
                  <button
                    onClick={handleStartRecording}
                    className="w-full py-3.5 bg-red-500 hover:bg-red-400 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer"
                    aria-label="Start recording"
                  >
                    <Circle className="w-4 h-4 fill-current" />
                    Start Recording
                  </button>
                  <button
                    type="button"
                    onClick={() => nativeVideoInputRef.current?.click()}
                    className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Use Native Camcorder Instead
                  </button>
                </div>
              )}

              {/* VIDEO mode — actively recording */}
              {mode === 'video' && phase === 'recording' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3 text-sm font-mono text-red-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold">{formatTime(recordingSeconds)}</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Recording…</span>
                  </div>

                  {recordingSeconds >= 150 && (
                    <div className="text-[11px] text-amber-400 font-mono text-center bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg">
                      ⚠ Approaching 50 MB backend limit — consider stopping soon.
                    </div>
                  )}

                  <button
                    onClick={handleStopRecording}
                    className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    aria-label="Stop recording"
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop Recording
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Post-capture actions (Photo) ── */}
          {phase === 'captured' && (
            <div className="px-5 py-4 border-t border-slate-800 space-y-2">
              <button
                onClick={handleUsePhoto}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                aria-label="Use captured photo for detection"
              >
                <CheckCircle2 className="w-4 h-4" />
                Use Photo — Run Detection
              </button>
              <button
                onClick={handleRetakePhoto}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                aria-label="Retake photo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake Photo
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2 bg-transparent hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                aria-label="Cancel and close camera"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Post-capture actions (Video) ── */}
          {phase === 'recorded' && (
            <div className="px-5 py-4 border-t border-slate-800 space-y-2">
              <div className="text-xs text-slate-400 font-mono bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800 mb-1">
                Format: <span className="text-amber-400">{extFromMime(recordedMimeType).toUpperCase()}</span>
                &nbsp;·&nbsp;Will be analyzed via <span className="text-amber-400">/api/detect/video</span>
              </div>
              <button
                onClick={handleUseVideo}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                aria-label="Use recorded video for detection"
              >
                <CheckCircle2 className="w-4 h-4" />
                Use Video — Run Detection
              </button>
              <button
                onClick={handleRecordAgain}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                aria-label="Record again"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Record Again
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2 bg-transparent hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                aria-label="Cancel and close camera"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* ── Footer tip ── */}
        <div className="px-5 py-3 border-t border-slate-800/60 text-[10px] font-mono text-slate-600 flex items-center justify-between">
          <span>Captured footage feeds into existing YOLOv11 Roboflow pipeline</span>
          <span className="text-slate-500">Dual Live + Native Capture</span>
        </div>
      </div>
    </div>
  );
};
