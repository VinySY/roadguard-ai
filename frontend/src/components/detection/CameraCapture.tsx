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
              onClick={() => startCamera(facingMode, mode)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
            >
              Try Again
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

      {/* Control Bar */}
      <div className="w-full p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
        {capturedPreview ? (
          <div className="w-full flex items-center justify-between">
            <button
              onClick={handleRetake}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retake {capturedPreview.type === 'image' ? 'Photo' : 'Video'}
            </button>
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-medium"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Use {capturedPreview.type === 'image' ? 'Photo' : 'Video'} in AI Detection</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode switch: PHOTO | VIDEO */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setMode('photo')}
                disabled={isRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'photo'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Photo</span>
              </button>
              <button
                onClick={() => setMode('video')}
                disabled={isRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'video'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video</span>
              </button>
            </div>

            {/* Shutter / Record Button */}
            <div>
              {mode === 'photo' ? (
                <button
                  onClick={takePhoto}
                  className="w-14 h-14 rounded-full border-4 border-amber-500 flex items-center justify-center p-1 hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Capture road photo"
                >
                  <div className="w-full h-full bg-amber-500 rounded-full shadow-lg"></div>
                </button>
              ) : isRecording ? (
                <button
                  onClick={stopVideoRecording}
                  className="w-14 h-14 rounded-full border-4 border-rose-500 flex items-center justify-center p-1 hover:scale-105 active:scale-95 transition-transform animate-pulse"
                  aria-label="Stop recording video"
                >
                  <div className="w-6 h-6 bg-rose-500 rounded-md"></div>
                </button>
              ) : (
                <button
                  onClick={startVideoRecording}
                  className="w-14 h-14 rounded-full border-4 border-rose-500 flex items-center justify-center p-1 hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Start recording video"
                >
                  <div className="w-full h-full bg-rose-500 rounded-full shadow-lg"></div>
                </button>
              )}
            </div>

            {/* Flip Camera & Close */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFacingMode}
                disabled={isRecording}
                title="Switch Camera (Front/Back)"
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
