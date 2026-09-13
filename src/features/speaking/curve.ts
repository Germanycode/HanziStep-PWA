import type { SemitonePoint } from '@/services/speech/pitch';

export interface CurveBox {
  width: number;
  height: number;
  /** Semitones shown from top to bottom (default ±6 around the median). */
  range?: number;
}

/**
 * SVG paths for a pitch curve. Unvoiced gaps split the line into several
 * paths, so silence is not drawn as a straight jump.
 */
export function curveSegments(points: readonly SemitonePoint[], box: CurveBox): string[] {
  const range = box.range ?? 12;
  const half = range / 2;
  const lastTime = points.at(-1)?.time ?? 0;
  const span = lastTime > 0 ? lastTime : 1;

  const segments: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point.value === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      continue;
    }
    const x = (point.time / span) * box.width;
    const clamped = Math.max(-half, Math.min(half, point.value));
    const y = box.height / 2 - (clamped / half) * (box.height / 2);
    current.push(`${current.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  if (current.length > 1) segments.push(current.join(' '));
  return segments;
}

/** True when a curve has enough voiced points to be worth drawing. */
export function hasVoice(points: readonly SemitonePoint[], minimum = 4): boolean {
  return points.filter((point) => point.value !== null).length >= minimum;
}
