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
    title: 'Upload Image',
    subtitle: 'Choose a photo',
    icon: <Image className="w-5 h-5" strokeWidth={2} />,
  },
  {
    id: 'take-photo',
    title: 'Take Photo',
    subtitle: 'Use your camera',
    icon: <Camera className="w-5 h-5" strokeWidth={2} />,
  },
  {
    id: 'upload-video',
    title: 'Upload Video',
    subtitle: 'Choose a video',
    icon: <Film className="w-5 h-5" strokeWidth={2} />,
  },
  {
    id: 'record-video',
    title: 'Record Video',
    subtitle: 'Use your camera',
    icon: <Video className="w-5 h-5" strokeWidth={2} />,
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
    // reset input value so re-selecting same file triggers event
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
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
        className="hidden"
      />

      {/* Symmetrical 2x2 Grid on Mobile, 4-column row on Desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
        {OPTIONS.map((opt) => {
          const isSelected = activeMethod === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleClick(opt.id)}
              className={`group relative flex flex-col items-center justify-center text-center w-full h-[124px] sm:h-[132px] p-3 sm:p-4 rounded-2xl border transition-all duration-150 select-none active:scale-[0.98] ${
                isSelected
                  ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/25 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm'
              }`}
            >
              {/* Icon Container (Identical size, shape, alignment across all 4) */}
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2.5 border transition-transform duration-150 group-hover:scale-105 shrink-0 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}
              >
                {opt.icon}
              </div>

              {/* Title (Symmetrical font size, identical line height, centered) */}
              <span
                className={`text-xs sm:text-sm font-semibold tracking-tight block w-full truncate px-1 transition-colors leading-tight ${
                  isSelected ? 'text-amber-400' : 'text-slate-100 group-hover:text-slate-50'
                }`}
              >
                {opt.title}
              </span>

              {/* Subtitle (Uniform text length, identical spacing and font) */}
              <span className="text-[10px] sm:text-[11px] text-slate-400 group-hover:text-slate-300 block w-full truncate px-1 mt-1 transition-colors leading-tight">
                {opt.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
