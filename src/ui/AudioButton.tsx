import { Volume2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

interface AudioButtonProps {
  label: string;
  onPlay: () => Promise<void>;
  children?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-7' } as const;

/** Speaker button that shows a playing state and reports playback errors. */
export function AudioButton({ label, onPlay, children, className = '', size = 'md' }: AudioButtonProps) {
  const [playing, setPlaying] = useState(false);

  const handleClick = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      await onPlay();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không phát được âm thanh.');
    } finally {
      setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center gap-2 rounded-full transition hover:text-primary ${className}`}
    >
      <Volume2 className={`${SIZES[size]} ${playing ? 'animate-pulse text-primary' : ''}`} aria-hidden />
      {children}
    </button>
  );
}
