import { describe, expect, it } from 'vitest';
import { formatClock, formatTimeLeft } from './time';

describe('formatTimeLeft', () => {
  it('formats each range in Vietnamese', () => {
    expect(formatTimeLeft(0)).toBe('Sẵn sàng');
    expect(formatTimeLeft(-5)).toBe('Sẵn sàng');
    expect(formatTimeLeft(1)).toBe('1 giây');
    expect(formatTimeLeft(65_000)).toBe('1 phút 5 giây');
    expect(formatTimeLeft(2 * 3600_000 + 5 * 60_000)).toBe('2 giờ 5 phút');
    expect(formatTimeLeft(2 * 86_400_000 + 3 * 3600_000)).toBe('2 ngày 3 giờ');
  });
});

describe('formatClock', () => {
  it('pads seconds and clamps negatives', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9_999)).toBe('0:09');
    expect(formatClock(125_000)).toBe('2:05');
    expect(formatClock(-1_000)).toBe('0:00');
  });
});
