/**
 * Seedable randomness. The English app shuffled with
 * `sort(() => Math.random() - 0.5)`, which is biased and untestable; every
 * shuffle here is Fisher–Yates over an injectable generator.
 */

export type Rng = () => number;

/** Small, fast 32-bit PRNG. Same seed → same sequence. */
export function mulberry32(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
}

export function randomInt(maxExclusive: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * maxExclusive);
}

/** Returns a shuffled copy; the input is not modified. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    const temp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = temp;
  }
  return result;
}

export function pickOne<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  return items.length === 0 ? undefined : items[randomInt(items.length, rng)];
}

/** Up to `count` distinct items in random order. */
export function sample<T>(items: readonly T[], count: number, rng: Rng = Math.random): T[] {
  return shuffle(items, rng).slice(0, Math.max(0, count));
}
