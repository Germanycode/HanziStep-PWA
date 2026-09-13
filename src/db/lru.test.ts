import { describe, expect, it } from 'vitest';
import { planLruEviction, type LruEntry } from './lru';

const entries: LruEntry[] = [
  { key: 'old', bytes: 100, createdAt: 1 },
  { key: 'middle', bytes: 100, createdAt: 2 },
  { key: 'new', bytes: 100, createdAt: 3 },
];

describe('planLruEviction', () => {
  it('keeps everything when it fits', () => {
    expect(planLruEviction(entries, 1000)).toEqual({ evict: [], freedBytes: 0, keptBytes: 300 });
  });

  it('evicts the oldest entries first', () => {
    expect(planLruEviction(entries, 200)).toMatchObject({ evict: ['old'], freedBytes: 100, keptBytes: 200 });
    expect(planLruEviction(entries, 100).evict).toEqual(['middle', 'old']);
  });

  it('evicts everything when the budget is zero', () => {
    expect(planLruEviction(entries, 0)).toMatchObject({ evict: ['new', 'middle', 'old'], keptBytes: 0, freedBytes: 300 });
  });

  it('drops a single entry that cannot fit on its own', () => {
    const plan = planLruEviction([{ key: 'huge', bytes: 500, createdAt: 9 }, ...entries], 250);
    expect(plan.evict).toContain('huge');
    expect(plan.keptBytes).toBeLessThanOrEqual(250);
  });

  it('handles an empty cache and negative sizes', () => {
    expect(planLruEviction([], 100)).toEqual({ evict: [], freedBytes: 0, keptBytes: 0 });
    expect(planLruEviction([{ key: 'odd', bytes: -5, createdAt: 1 }], 10).evict).toEqual([]);
  });
});
