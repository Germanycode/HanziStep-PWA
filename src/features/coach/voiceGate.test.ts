import { describe, expect, it } from 'vitest';
import { DUCK_MS, initialGate, MIN_RMS, rms, SILENCE_HOLD, stepGate, STRONG_RMS, TAIL_MS, type GateState } from './voiceGate';

const quiet = 0.001;
const speech = (MIN_RMS + STRONG_RMS) / 2;

function run(state: GateState, frames: { rms: number; now: number }[]) {
  let current = state;
  let last = stepGate(current, frames[0] ?? { rms: 0, now: 0 });
  for (const frame of frames) {
    last = stepGate(current, frame);
    current = { open: last.open, quietFrames: last.quietFrames, tailUntil: last.tailUntil, duckUntil: last.duckUntil };
  }
  return { state: current, last };
}

describe('rms', () => {
  it('measures loudness and treats an empty frame as silence', () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1);
    expect(rms(new Float32Array(64))).toBe(0);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe('stepGate', () => {
  it('stays closed while the room is quiet', () => {
    const { last } = run(initialGate(), [
      { rms: quiet, now: 0 },
      { rms: quiet, now: 20 },
    ]);
    expect(last).toMatchObject({ open: false, send: false, duck: false, justClosed: false });
  });

  it('opens as soon as the learner speaks', () => {
    const result = stepGate(initialGate(), { rms: speech, now: 100 });
    expect(result).toMatchObject({ open: true, send: true });
    expect(result.tailUntil).toBe(100 + TAIL_MS);
  });

  it('ducks the coach only for loud speech (barge-in)', () => {
    expect(stepGate(initialGate(), { rms: speech, now: 0 }).duck).toBe(false);
    const loud = stepGate(initialGate(), { rms: STRONG_RMS + 0.01, now: 0 });
    expect(loud.duck).toBe(true);
    expect(loud.duckUntil).toBe(DUCK_MS);
  });

  it('keeps streaming through the tail, then closes exactly once', () => {
    const open = stepGate(initialGate(), { rms: speech, now: 1000 });
    let state: GateState = { open: open.open, quietFrames: open.quietFrames, tailUntil: open.tailUntil, duckUntil: open.duckUntil };

    // Quiet frames inside the tail window still stream.
    for (let index = 0; index < SILENCE_HOLD + 2; index++) {
      const result = stepGate(state, { rms: quiet, now: 1000 + index * 20 });
      expect(result.send).toBe(true);
      state = { open: result.open, quietFrames: result.quietFrames, tailUntil: result.tailUntil, duckUntil: result.duckUntil };
    }

    // After the tail, the hold counter closes the gate.
    let closings = 0;
    for (let index = 0; index < SILENCE_HOLD + 3; index++) {
      const result = stepGate(state, { rms: quiet, now: 1000 + TAIL_MS + 100 + index * 20 });
      if (result.justClosed) closings++;
      state = { open: result.open, quietFrames: result.quietFrames, tailUntil: result.tailUntil, duckUntil: result.duckUntil };
    }
    expect(closings).toBe(1);
    expect(state.open).toBe(false);
  });

  it('a short pause in the middle of a sentence does not close the gate', () => {
    const { state } = run(initialGate(), [
      { rms: speech, now: 0 },
      { rms: quiet, now: 20 },
      { rms: quiet, now: 40 },
      { rms: speech, now: 60 },
    ]);
    expect(state.open).toBe(true);
    expect(state.quietFrames).toBe(0);
  });
});
