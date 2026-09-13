import { describe, expect, it } from 'vitest';
import { classifyTone, detectPitch, pitchCurve, toSemitones } from './pitch';

const SAMPLE_RATE = 16_000;

/** A tone whose frequency glides from `fromHz` to `toHz` (or follows `shape`). */
function makeTone(durationMs: number, shape: (progress: number) => number, sampleRate = SAMPLE_RATE): Float32Array {
  const length = Math.round((durationMs / 1000) * sampleRate);
  const samples = new Float32Array(length);
  let phase = 0;
  for (let index = 0; index < length; index++) {
    const frequency = shape(index / length);
    phase += (2 * Math.PI * frequency) / sampleRate;
    // A couple of harmonics make it closer to a voice than a pure sine.
    samples[index] = 0.6 * Math.sin(phase) + 0.3 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
  }
  return samples;
}

const glide = (fromHz: number, toHz: number) => (progress: number) => fromHz + (toHz - fromHz) * progress;

describe('detectPitch', () => {
  it('finds the fundamental of a steady tone', () => {
    for (const hz of [110, 180, 240]) {
      const detected = detectPitch(makeTone(60, () => hz), SAMPLE_RATE);
      expect(detected).not.toBeNull();
      expect(Math.abs((detected ?? 0) - hz) / hz).toBeLessThan(0.03);
    }
  });

  it('returns null for silence and for a too-short window', () => {
    expect(detectPitch(new Float32Array(1024), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(new Float32Array(1), SAMPLE_RATE)).toBeNull();
  });

  it('rejects noise', () => {
    const noise = new Float32Array(1024);
    let seed = 42;
    for (let index = 0; index < noise.length; index++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise[index] = (seed / 2147483648) * 2 - 1;
    }
    expect(detectPitch(noise, SAMPLE_RATE)).toBeNull();
  });

  it('never reports a pitch outside the search range', () => {
    // A 2000 Hz tone is also periodic at 400 Hz, so autocorrelation cannot
    // reject it; what matters is that the answer stays inside the range.
    const detected = detectPitch(makeTone(60, () => 2000), SAMPLE_RATE, { minHz: 70, maxHz: 400 });
    if (detected !== null) {
      expect(detected).toBeGreaterThanOrEqual(70);
      expect(detected).toBeLessThanOrEqual(400);
    }
  });
});

describe('pitchCurve and toSemitones', () => {
  it('tracks a steady tone across windows', () => {
    const points = pitchCurve(makeTone(300, () => 200), SAMPLE_RATE);
    expect(points.length).toBeGreaterThan(10);
    const voiced = points.filter((point) => point.hz !== null);
    expect(voiced.length).toBeGreaterThan(points.length * 0.8);
  });

  it('centres a flat tone on zero semitones', () => {
    const values = toSemitones(pitchCurve(makeTone(300, () => 200), SAMPLE_RATE))
      .map((point) => point.value)
      .filter((value): value is number => value !== null);
    expect(Math.max(...values.map(Math.abs))).toBeLessThan(0.5);
  });

  it('keeps silence as null', () => {
    expect(toSemitones([{ time: 0, hz: null }])).toEqual([{ time: 0, value: null }]);
  });
});

describe('classifyTone (experimental)', () => {
  const curveOf = (shape: (progress: number) => number) => pitchCurve(makeTone(400, shape), SAMPLE_RATE);

  it('recognises a flat first tone', () => {
    expect(classifyTone(curveOf(() => 220))).toBe(1);
  });

  it('recognises a rising second tone', () => {
    expect(classifyTone(curveOf(glide(160, 260)))).toBe(2);
  });

  it('recognises a falling fourth tone', () => {
    expect(classifyTone(curveOf(glide(280, 150)))).toBe(4);
  });

  it('recognises the dip of a third tone', () => {
    expect(classifyTone(curveOf((progress) => (progress < 0.5 ? 200 - 60 * progress * 2 : 140 + 80 * (progress - 0.5) * 2)))).toBe(3);
  });

  it('gives up on too little signal', () => {
    expect(classifyTone([])).toBeNull();
    expect(classifyTone([{ time: 0, hz: 200 }])).toBeNull();
  });
});
