import { describe, expect, it } from 'vitest';
import type { SemitonePoint } from '@/services/speech/pitch';
import { curveSegments, hasVoice } from './curve';

const box = { width: 100, height: 40 };

function points(values: (number | null)[]): SemitonePoint[] {
  return values.map((value, index) => ({ time: index * 0.02, value }));
}

describe('curveSegments', () => {
  it('draws one path for a continuous curve', () => {
    const segments = curveSegments(points([0, 1, 2]), box);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.startsWith('M')).toBe(true);
    expect(segments[0]?.split('L')).toHaveLength(3);
  });

  it('breaks the line where the voice stops', () => {
    expect(curveSegments(points([0, 1, null, 2, 3]), box)).toHaveLength(2);
  });

  it('drops single points that cannot make a line', () => {
    expect(curveSegments(points([0, null, 1, null, 2]), box)).toEqual([]);
  });

  it('puts the median in the middle and clamps outliers to the box', () => {
    const [flat] = curveSegments(points([0, 0]), box);
    expect(flat).toContain('20.0');
    const [extreme] = curveSegments(points([50, 50]), { ...box, range: 12 });
    expect(extreme).toContain(',0.0');
  });

  it('handles an empty curve', () => {
    expect(curveSegments([], box)).toEqual([]);
    expect(hasVoice([])).toBe(false);
    expect(hasVoice(points([1, 2, 3, 4]))).toBe(true);
  });
});
