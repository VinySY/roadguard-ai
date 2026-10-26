import React, { useRef, useState, useEffect } from 'react';
import { Camera, Video, RefreshCw, Check, X, FlipHorizontal, AlertCircle, Play } from 'lucide-react';

interface CameraCaptureProps {
  onCaptureEvidence: (evidence: { type: 'image' | 'video'; blob: Blob; previewUrl: string }) => void;
  onCancel?: () => void;
  initialMode?: 'photo' | 'video';
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCaptureEvidence,
  onCancel,
  initialMode = 'photo',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<'photo' | 'video'>(initialMode);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [capturedPreview, setCapturedPreview] = useState<{
    type: 'image' | 'video';
    blob: Blob;
    previewUrl: string;
  } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  // Initialize camera stream
  const startCamera = async (facing: 'environment' | 'user', currentMode: 'photo' | 'video') => {
    try {
      setIsRequesting(true);
      setStreamError(null);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: currentMode === 'video',
        });
      } catch (audioErr) {
        // Fallback to video only if microphone access was denied or unavailable
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera access error', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStreamError('Camera permission was blocked. Please grant camera access in your browser site settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStreamError('No optical camera device was detected on this system.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setStreamError('Camera is currently in use by another application or tab.');
      } else {
        setStreamError('Could not initialize camera preview. Please check device permissions.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    if (!capturedPreview) {
      startCamera(facingMode, mode);
    }
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, mode, capturedPreview]);

  // Video recording timer
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          setCapturedPreview({ type: 'image', blob, previewUrl });
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          }
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const startVideoRecording = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    recordedChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreview({ type: 'video', blob, previewUrl });
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500); // 500ms chunk interval
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start MediaRecorder', e);
      setStreamError('Media recording is not supported in this browser environment.');
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    }
  };

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview.previewUrl);
      setCapturedPreview(null);
    }
    startCamera(facingMode, mode);
  };

  const handleConfirm = () => {
    if (capturedPreview) {
      onCaptureEvidence(capturedPreview);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-100 flex flex-col items-center">
      {/* Viewport / Stream / Preview */}
      <div className="relative w-full aspect-video md:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
        {streamError ? (
          <div className="p-6 text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm text-rose-300 font-medium mb-3">{streamError}</p>
            <button
              type="button"
              onClick={() => startCamera(facingMode, mode)}
              className="rg-btn rg-btn-secondary"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : capturedPreview ? (
          capturedPreview.type === 'image' ? (
            <img
              src={capturedPreview.previewUrl}
              alt="Captured Road Evidence"
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              src={capturedPreview.previewUrl}
              controls
              className="w-full h-full object-contain"
              autoPlay
              loop
            />
          )
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Viewfinder crosshairs / guide */}
            <div className="absolute inset-6 pointer-events-none border border-white/20 rounded-xl flex flex-col justify-between p-3">
              <div className="flex justify-between text-[11px] font-mono text-white/70">
                <span>ROADGUARD OPTICAL</span>
                <span className="uppercase">{mode} MODE</span>
              </div>
              {isRecording && (
                <div className="flex items-center gap-2 bg-rose-600/90 text-white px-3.5 py-1.5 rounded-full text-xs font-mono self-center animate-pulse shadow-lg">
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                  <span>REC {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-mono text-white/50">
                <span>HOLD DEVICE STEADY</span>
                <span>FOCUSED ON ROAD DISTRESS</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Control bar */}
      <div className="flex w-full items-center justify-between gap-4 border-t border-slate-800 bg-slate-900 p-4">
        {capturedPreview ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={handleRetake} className="rg-btn rg-btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retake {capturedPreview.type === 'image' ? 'photo' : 'video'}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {onCancel && (
                <button type="button" onClick={onCancel} className="rg-btn rg-btn-ghost">
                  Cancel
                </button>
              )}
              <button type="button" onClick={handleConfirm} className="rg-btn rg-btn-primary">
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Use {capturedPreview.type === 'image' ? 'photo' : 'video'} in AI detection</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode switch: PHOTO | VIDEO */}
            <div
              role="group"
              aria-label="Capture mode"
              className="flex items-center rounded-lg bg-slate-800 p-1"
            >
              <button
                type="button"
                onClick={() => setMode('photo')}
                disabled={isRecording}
                aria-pressed={mode === 'photo'}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  mode === 'photo'
                    ? 'bg-amber-500 font-semibold text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('video')}
                disabled={isRecording}
                aria-pressed={mode === 'video'}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  mode === 'video'
                    ? 'bg-amber-500 font-semibold text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Video</span>
              </button>
            </div>

            {/* Shutter / record button */}
            <div>
              {mode === 'photo' ? (
                <button
                  type="button"
                  onClick={takePhoto}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-500 p-1 transition-transform hover:scale-105 active:scale-95"
                  aria-label="Capture road photo"
                >
                  <div className="h-full w-full rounded-full bg-amber-500 shadow-lg" />
                </button>
              ) : isRecording ? (
                <button
                  type="button"
                  onClick={stopVideoRecording}
                  className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full border-4 border-rose-500 p-1 transition-transform hover:scale-105 active:scale-95"
                  aria-label="Stop recording video"
                >
                  <div className="h-6 w-6 rounded-md bg-rose-500" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVideoRecording}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-rose-500 p-1 transition-transform hover:scale-105 active:scale-95"
                  aria-label="Start recording video"
                >
                  <div className="h-full w-full rounded-full bg-rose-500 shadow-lg" />
                </button>
              )}
            </div>

            {/* Flip camera & close */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isRecording}
                title="Switch camera (front/back)"
                aria-label="Switch camera between front and back"
                className="rg-icon-btn disabled:opacity-50"
              >
                <FlipHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rg-icon-btn"
                  aria-label="Close camera capture"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
