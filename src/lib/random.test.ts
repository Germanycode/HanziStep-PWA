import { describe, expect, it } from 'vitest';
import { mulberry32, pickOne, sample, shuffle } from './random';

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = Array.from({ length: 1000 }, () => a());
    const seqB = Array.from({ length: 1000 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(c()).not.toBe(seqA[0]);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = shuffle(input, mulberry32(7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...output].sort((x, y) => x - y)).toEqual(input);
  });

  it('produces all orderings uniformly (chi-square, df = 5, p = 0.001)', () => {
    const rng = mulberry32(2026);
    const counts = new Map<string, number>();
    const trials = 60_000;
    for (let i = 0; i < trials; i++) {
      const key = shuffle(['a', 'b', 'c'], rng).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    const expected = trials / 6;
    const chiSquare = [...counts.values()].reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(20.52);
  });
});

describe('sample and pickOne', () => {
  it('samples distinct items and handles edge cases', () => {
    const rng = mulberry32(1);
    const picked = sample([1, 2, 3, 4, 5], 3, rng);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(sample([1, 2], 5, rng)).toHaveLength(2);
    expect(sample([1, 2], -1, rng)).toEqual([]);
    expect(pickOne([], rng)).toBeUndefined();
    expect([1, 2, 3]).toContain(pickOne([1, 2, 3], rng));
  });
});
