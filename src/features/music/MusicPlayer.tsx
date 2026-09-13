import { Music, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { updateSettings, useLoadedSettings } from '@/db/settings';
import { DUCKED_VOLUME_FACTOR, useMixer } from '@/services/audio/mixer';
import { DEFAULT_TRACK, findTrack, MUSIC_TRACKS } from './tracks';

/**
 * Floating background-music player, ported from the English extension's
 * `initMusicPlayer`: track list, persisted track and volume, autoplay after
 * the first user gesture, and a close button.
 */
export function MusicPlayer() {
  const settings = useLoadedSettings();
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplayArmed = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const ducked = useMixer((state) => state.duckReasons.length > 0);

  const track = findTrack(settings?.musicTrack ?? DEFAULT_TRACK.id);
  const volume = volumeDraft ?? settings?.musicVolume ?? 0.4;

  // Load the selected track imperatively so a re-render never restarts playback.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audio.src.endsWith(track.src)) return;
    const wasPlaying = !audio.paused;
    audio.src = track.src;
    audio.load();
    if (wasPlaying) audio.play().catch(() => {});
  }, [track.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = ducked ? volume * DUCKED_VOLUME_FACTOR : volume;
  }, [volume, ducked]);

  // Browsers block audio until the user interacts, so try on the first gesture (once per session).
  useEffect(() => {
    if (!settings?.musicAutoplay || autoplayArmed.current) return;
    autoplayArmed.current = true;
    const events = ['pointerdown', 'keydown'] as const;
    const cleanup = () => events.forEach((name) => document.removeEventListener(name, tryPlay));
    function tryPlay() {
      const audio = audioRef.current;
      if (!audio) return;
      audio.play().then(cleanup, () => {});
    }
    events.forEach((name) => document.addEventListener(name, tryPlay));
    tryPlay();
    return cleanup;
  }, [settings?.musicAutoplay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  const commitVolume = () => {
    if (volumeDraft === null) return;
    void updateSettings({ musicVolume: volumeDraft }).then(() => setVolumeDraft(null));
  };

  return (
    <>
      <audio
        ref={audioRef}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.currentTarget;
          if (duration) setProgress((currentTime / duration) * 100);
        }}
      />
      {hidden ? (
        <button
          type="button"
          onClick={() => setHidden(false)}
          aria-label="Mở trình phát nhạc"
          className="fixed right-4 bottom-4 z-40 grid size-11 place-items-center rounded-full border border-line bg-surface text-sub shadow-lg hover:text-fg"
        >
          <Music className="size-5" aria-hidden />
        </button>
      ) : (
        <div className="fixed right-4 bottom-4 left-4 z-40 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2 pr-3 shadow-xl backdrop-blur sm:left-auto sm:w-[26rem]">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Tạm dừng nhạc' : 'Phát nhạc'}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-r from-primary to-primary-end text-white"
          >
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          </button>
          <div className="min-w-0 flex-1">
            <select
              aria-label="Chọn nhạc nền"
              value={track.id}
              onChange={(event) => void updateSettings({ musicTrack: event.target.value })}
              className="w-full truncate bg-transparent text-sm font-medium text-fg outline-none"
            >
              {MUSIC_TRACKS.map((item) => (
                <option key={item.id} value={item.id} className="bg-surface">
                  {item.title}
                </option>
              ))}
            </select>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="Âm lượng nhạc nền"
            onChange={(event) => setVolumeDraft(Number(event.target.value))}
            onPointerUp={commitVolume}
            onKeyUp={commitVolume}
            onBlur={commitVolume}
            className="w-20 accent-primary"
          />
          <button
            type="button"
            onClick={() => {
              audioRef.current?.pause();
              setHidden(true);
            }}
            aria-label="Ẩn trình phát nhạc"
            className="text-muted hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
