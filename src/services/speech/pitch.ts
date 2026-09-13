/**
 * Pitch tracking for shadowing (docs/PLAN.md §8.4).
 *
 * Normalised autocorrelation, written here instead of pulling in a library:
 * a syllable is a few hundred milliseconds, so the work is tiny, and the tone
 * classifier below must stay clearly labelled as experimental.
 */

export interface PitchPoint {
  /** Seconds from the start of the clip. */
  time: number;
  hz: number | null;
}

export interface DetectOptions {
  minHz?: number;
  maxHz?: number;
  /** Minimum normalised correlation for a pitch to count. */
  threshold?: number;
  /** Below this RMS the window counts as silence. */
  silenceRms?: number;
}

/** Fundamental frequency of one window, or null for silence and noise. */
export function detectPitch(samples: Float32Array, sampleRate: number, options: DetectOptions = {}): number | null {
  const minHz = options.minHz ?? 70;
  const maxHz = options.maxHz ?? 400;
  const threshold = options.threshold ?? 0.5;
  const silenceRms = options.silenceRms ?? 0.01;
  if (samples.length < 2) return null;

  let mean = 0;
  for (const sample of samples) mean += sample;
  mean /= samples.length;

  const centred = new Float32Array(samples.length);
  let energy = 0;
  for (let index = 0; index < samples.length; index++) {
    const value = (samples[index] ?? 0) - mean;
    centred[index] = value;
    energy += value * value;
  }
  if (Math.sqrt(energy / samples.length) < silenceRms) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(samples.length - 1, Math.ceil(sampleRate / minHz));
  if (maxLag <= minLag) return null;

  const scores = new Float64Array(maxLag + 2);
  let bestLag = -1;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = 0; index + lag < centred.length; index++) {
      const a = centred[index] ?? 0;
      const b = centred[index + lag] ?? 0;
      correlation += a * b;
      leftEnergy += a * a;
      rightEnergy += b * b;
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    const score = denominator > 0 ? correlation / denominator : 0;
    scores[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestScore < threshold) return null;

  // A voice also correlates at two or three times its period, so take the
  // shortest peak that is nearly as strong — otherwise the pitch reads an
  // octave (or a twelfth) too low.
  const acceptable = bestScore * 0.9;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const score = scores[lag] ?? 0;
    if (score < acceptable) continue;
    if (score >= (scores[lag - 1] ?? 0) && score >= (scores[lag + 1] ?? 0)) {
      bestLag = lag;
      bestScore = score;
      break;
    }
  }

  // Parabolic interpolation around the peak, so the result is not quantised to whole samples.
  const before = scores[bestLag - 1] ?? 0;
  const after = scores[bestLag + 1] ?? 0;
  const divisor = 2 * (2 * bestScore - before - after);
  const shift = divisor === 0 ? 0 : (after - before) / divisor;
  return sampleRate / (bestLag + shift);
}

export interface CurveOptions extends DetectOptions {
  /** Window length in milliseconds (default 40). */
  windowMs?: number;
  /** Step between windows in milliseconds (default 20). */
  hopMs?: number;
}

export function pitchCurve(samples: Float32Array, sampleRate: number, options: CurveOptions = {}): PitchPoint[] {
  const windowSize = Math.round(((options.windowMs ?? 40) / 1000) * sampleRate);
  const hop = Math.max(1, Math.round(((options.hopMs ?? 20) / 1000) * sampleRate));
  const points: PitchPoint[] = [];
  for (let start = 0; start + windowSize <= samples.length; start += hop) {
    const window = samples.subarray(start, start + windowSize);
    points.push({ time: start / sampleRate, hz: detectPitch(window, sampleRate, options) });
  }
  return points;
}

export interface SemitonePoint {
  time: number;
  /** Semitones away from the clip's median pitch; null where there was no pitch. */
  value: number | null;
}

/** Normalises a curve so two different voices can be laid over each other. */
export function toSemitones(points: readonly PitchPoint[]): SemitonePoint[] {
  const voiced = points.map((point) => point.hz).filter((hz): hz is number => hz !== null && hz > 0);
  if (voiced.length === 0) return points.map((point) => ({ time: point.time, value: null }));
  const sorted = [...voiced].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1;
  return points.map((point) => ({
    time: point.time,
    value: point.hz && point.hz > 0 ? 12 * Math.log2(point.hz / median) : null,
  }));
}

export type ToneGuess = 1 | 2 | 3 | 4 | null;

/**
 * Rough tone of a single syllable. Labelled experimental in the UI: a short
 * clip, background noise or a creaky voice all break it easily.
 */
export function classifyTone(points: readonly PitchPoint[]): ToneGuess {
  const values = toSemitones(points)
    .map((point) => point.value)
    .filter((value): value is number => value !== null);
  if (values.length < 5) return null;

  // Drop the edges, where the pitch tracker is least reliable.
  const trim = Math.floor(values.length * 0.1);
  const core = values.slice(trim, values.length - trim);
  if (core.length < 4) return null;

  const first = core[0] ?? 0;
  const last = core[core.length - 1] ?? 0;
  const min = Math.min(...core);
  const max = Math.max(...core);
  const minIndex = core.indexOf(min);
  const slope = last - first;

  if (max - min < 1.5) return 1;
  // A dip in the middle with both ends clearly higher is the third tone.
  if (minIndex > core.length * 0.2 && minIndex < core.length * 0.8 && first - min > 1 && last - min > 1) return 3;
  if (slope > 1.5) return 2;
  if (slope < -1.5) return 4;
  return null;
}
