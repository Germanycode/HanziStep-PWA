import { describe, expect, it } from 'vitest';
import { addDays, dayDiff, isDayKey, lastNDays, parseDayKey, toDayKey } from './dayKey';

describe('toDayKey', () => {
  it('runs in UTC+7 (guards the timezone set in vitest.config.ts)', () => {
    expect(new Date(2026, 8, 11, 6, 59).toISOString()).toBe('2026-09-10T23:59:00.000Z');
  });

  it('uses the local calendar day, not the UTC day (old extension bug)', () => {
    const beforeSeven = new Date(2026, 8, 11, 6, 59);
    const afterSeven = new Date(2026, 8, 11, 7, 1);
    expect(beforeSeven.toISOString().slice(0, 10)).toBe('2026-09-10'); // what the old code stored
    expect(toDayKey(beforeSeven)).toBe('2026-09-11');
    expect(toDayKey(afterSeven)).toBe('2026-09-11');
  });

  it('switches at local midnight', () => {
    expect(toDayKey(new Date(2026, 8, 11, 23, 59, 59))).toBe('2026-09-11');
    expect(toDayKey(new Date(2026, 8, 12, 0, 0, 0))).toBe('2026-09-12');
  });

  it('accepts timestamps', () => {
    expect(toDayKey(new Date(2026, 0, 1, 12).getTime())).toBe('2026-01-01');
  });

  it('shifts the day boundary with dayStartHour', () => {
    expect(toDayKey(new Date(2026, 8, 12, 2, 30), 3)).toBe('2026-09-11');
    expect(toDayKey(new Date(2026, 8, 12, 3, 0), 3)).toBe('2026-09-12');
    expect(toDayKey(new Date(2026, 0, 1, 1, 0), 3)).toBe('2025-12-31');
  });
});

describe('day arithmetic', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days in both directions', () => {
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayDiff('2026-09-11', '2026-09-11')).toBe(0);
    expect(dayDiff('2026-09-11', '2026-09-01')).toBe(-10);
    expect(dayDiff('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('lists the last N days oldest first', () => {
    expect(lastNDays('2026-01-02', 3)).toEqual(['2025-12-31', '2026-01-01', '2026-01-02']);
    expect(lastNDays('2026-01-02', 0)).toEqual([]);
  });
});

describe('parseDayKey', () => {
  it('rejects malformed or impossible dates', () => {
    expect(() => parseDayKey('2026-02-30')).toThrow();
    expect(() => parseDayKey('2026-9-1')).toThrow();
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey(20260911)).toBe(false);
    expect(isDayKey('2026-09-11')).toBe(true);
  });
});
