import { duckMusic, unduckMusic } from './mixer';

export interface PlayClipOptions {
  /** Playback speed; 0.75 for "slow". */
  rate?: number;
  signal?: AbortSignal;
}

let current: HTMLAudioElement | null = null;

export function stopClip(): void {
  if (current) {
    current.pause();
    current = null;
  }
  unduckMusic('clip');
}

/** Plays one short recording (syllable or word audio) and resolves when it ends. Starting a clip stops the previous one. */
export function playClip(url: string, options: PlayClipOptions = {}): Promise<void> {
  stopClip();
  const audio = new Audio(url);
  audio.playbackRate = options.rate ?? 1;
  current = audio;
  duckMusic('clip');

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (current === audio) {
        current = null;
        unduckMusic('clip');
      }
      options.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      audio.pause();
      cleanup();
      resolve();
    };
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onpause = () => {
      // Paused by stopClip() or another clip: finish quietly.
      if (current !== audio) resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error(`Could not play ${url}`));
    };
    options.signal?.addEventListener('abort', onAbort);
    audio.play().catch((error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/** Recording from audio-cmn: key is the toneless syllable with ü written as "v" (e.g. "lv"). */
export function syllableAudioUrl(key: string, tone: number): string {
  return `/audio/syllables/${key}${tone}.mp3`;
}

export function playSyllable(key: string, tone: number, options: PlayClipOptions = {}): Promise<void> {
  return playClip(syllableAudioUrl(key, tone), options);
}
