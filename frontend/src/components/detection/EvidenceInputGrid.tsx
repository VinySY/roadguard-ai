import React, { useRef } from 'react';
import { Image, Camera, Film, Video } from 'lucide-react';

export type EvidenceMethod = 'upload-image' | 'take-photo' | 'upload-video' | 'record-video';

interface EvidenceInputGridProps {
  activeMethod?: EvidenceMethod | null;
  onSelectMethod: (method: EvidenceMethod) => void;
  onImageFileSelect?: (file: File) => void;
  onVideoFileSelect?: (file: File) => void;
  isActionOnly?: boolean; // If true, does not trigger file pickers directly, just selects method
}

interface OptionConfig {
  id: EvidenceMethod;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const OPTIONS: OptionConfig[] = [
  {
    id: 'upload-image',
    title: 'Upload image',
    subtitle: 'Choose a photo',
    icon: <Image className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'take-photo',
    title: 'Take photo',
    subtitle: 'Use your camera',
    icon: <Camera className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'upload-video',
    title: 'Upload video',
    subtitle: 'Choose a video',
    icon: <Film className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'record-video',
    title: 'Record video',
    subtitle: 'Use your camera',
    icon: <Video className="h-5 w-5" strokeWidth={2} aria-hidden="true" />,
  },
];

export const EvidenceInputGrid: React.FC<EvidenceInputGridProps> = ({
  activeMethod,
  onSelectMethod,
  onImageFileSelect,
  onVideoFileSelect,
  isActionOnly = false,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleClick = (id: EvidenceMethod) => {
    onSelectMethod(id);

    if (!isActionOnly) {
      if (id === 'upload-image' && imageInputRef.current) {
        imageInputRef.current.click();
      } else if (id === 'upload-video' && videoInputRef.current) {
        videoInputRef.current.click();
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageFileSelect) {
      onImageFileSelect(file);
    }
    e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onVideoFileSelect) {
      onVideoFileSelect(file);
    }
    e.target.value = '';
  };

  return (
    <div className="w-full">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
        aria-label="Choose a road photo"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
        className="hidden"
        aria-label="Choose a road video"
      />

      <div className="grid w-full grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {OPTIONS.map((opt) => {
          const isSelected = activeMethod === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleClick(opt.id)}
              aria-pressed={isSelected}
              className={`group relative flex h-[100px] w-full select-none flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-colors sm:h-[112px] sm:p-3 ${
                isSelected
                  ? 'border-amber-500/70 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                  : 'border-slate-700/60 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900'
              }`}
            >
              <span
                className={`mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-transform group-hover:scale-105 sm:h-10 sm:w-10 ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-md'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                }`}
              >
                {opt.icon}
              </span>

              <span
                className={`block w-full truncate px-1 text-xs font-semibold leading-tight tracking-tight ${
                  isSelected ? 'text-amber-300' : 'text-slate-100'
                }`}
              >
                {opt.title}
              </span>

              <span className="mt-0.5 block w-full truncate px-1 text-[10px] leading-tight text-slate-400 sm:text-[11px]">
                {opt.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
