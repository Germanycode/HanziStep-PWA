/**
 * Decides when the learner's microphone audio is sent to the coach and when the
 * coach's own voice is ducked. Ported from the English extension with the same
 * constants (docs/PLAN.md §8.5); kept pure so it can be tested frame by frame.
 */

export const MIN_RMS = 0.012;
export const STRONG_RMS = 0.075;
/** Quiet frames in a row before the gate closes. */
export const SILENCE_HOLD = 6;
/** Keep streaming this long after the voice stops, so word endings survive. */
export const TAIL_MS = 800;
/** Duck the coach's voice this long after the learner speaks up. */
export const DUCK_MS = 280;

export interface GateState {
  open: boolean;
  quietFrames: number;
  /** Streaming continues until this timestamp even when the frame is quiet. */
  tailUntil: number;
  /** The coach's audio stays quiet until this timestamp. */
  duckUntil: number;
}

export function initialGate(): GateState {
  return { open: false, quietFrames: 0, tailUntil: 0, duckUntil: 0 };
}

export function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let total = 0;
  for (const sample of frame) total += sample * sample;
  return Math.sqrt(total / frame.length);
}

export interface GateInput {
  rms: number;
  /** Milliseconds, from performance.now() or Date.now(). */
  now: number;
}

export interface GateResult extends GateState {
  /** This frame should be sent to the model. */
  send: boolean;
  /** The coach's playback should be quiet right now. */
  duck: boolean;
  /** The learner just stopped talking (end of one turn). */
  justClosed: boolean;
}

export function stepGate(state: GateState, input: GateInput): GateResult {
  const next: GateState = { ...state };
  let justClosed = false;

  if (input.rms >= MIN_RMS) {
    next.open = true;
    next.quietFrames = 0;
    next.tailUntil = input.now + TAIL_MS;
    if (input.rms >= STRONG_RMS) next.duckUntil = input.now + DUCK_MS;
  } else if (state.open) {
    next.quietFrames = state.quietFrames + 1;
    if (next.quietFrames >= SILENCE_HOLD && input.now > state.tailUntil) {
      next.open = false;
      next.quietFrames = 0;
      justClosed = true;
    }
  }

  return {
    ...next,
    // Strictly before the deadline: an unset or expired deadline must not count.
    send: next.open || input.now < next.tailUntil,
    duck: input.now < next.duckUntil,
    justClosed,
  };
}
