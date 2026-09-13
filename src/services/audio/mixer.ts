import { create } from 'zustand';

/** Music volume multiplier while speech, recording or the coach is active. */
export const DUCKED_VOLUME_FACTOR = 0.2;

interface MixerState {
  duckReasons: string[];
  duck: (reason: string) => void;
  unduck: (reason: string) => void;
}

/**
 * Background music is lowered while any reason is active (e.g. "tts",
 * "recording", "coach"), so overlapping features can't restore it too early.
 */
export const useMixer = create<MixerState>()((set) => ({
  duckReasons: [],
  duck: (reason) =>
    set((state) => (state.duckReasons.includes(reason) ? state : { duckReasons: [...state.duckReasons, reason] })),
  unduck: (reason) => set((state) => ({ duckReasons: state.duckReasons.filter((item) => item !== reason) })),
}));

export function duckMusic(reason: string): void {
  useMixer.getState().duck(reason);
}

export function unduckMusic(reason: string): void {
  useMixer.getState().unduck(reason);
}
