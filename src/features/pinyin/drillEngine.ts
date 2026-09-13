import type { Rng } from '@/lib/random';
import type { DrillItemStat, DrillStats } from '@/progress/state';
import { DRILL_ROUND_BONUS, XP_RULES } from '@/progress/xp';

/**
 * Adaptive practice for pinyin and tones (not SM-2). Each item keeps a running
 * error rate; items that are often wrong are picked more often.
 */
export const EMA_ALPHA = 0.3;
export const UNSEEN_ERROR_RATE = 0.5;
/** Every item keeps a minimum chance so mastered sounds still come back. */
export const MIN_WEIGHT = 0.15;
export const ROUND_SIZE = 10;
export const TONE_RECENT_LIMIT = 100;

export function updateItemStat(stat: DrillItemStat | undefined, correct: boolean, now: number): DrillItemStat {
  const previous = stat?.ema ?? UNSEEN_ERROR_RATE;
  const error = correct ? 0 : 1;
  return { ema: previous + EMA_ALPHA * (error - previous), attempts: (stat?.attempts ?? 0) + 1, lastAt: now };
}

export function itemWeight(stat: DrillItemStat | undefined): number {
  return MIN_WEIGHT + (stat?.ema ?? UNSEEN_ERROR_RATE);
}

export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let target = rng() * total;
  for (let index = 0; index < items.length; index++) {
    target -= weights[index] ?? 0;
    if (target < 0) return items[index];
  }
  return items[items.length - 1];
}

/** `count` item keys weighted by error rate, never the same key twice in a row. */
export function buildRound(keys: readonly string[], stats: DrillStats, count: number, rng: Rng): string[] {
  const round: string[] = [];
  for (let index = 0; index < count; index++) {
    const previous = round[round.length - 1];
    const pool = keys.length > 1 ? keys.filter((key) => key !== previous) : keys;
    const next = pickWeighted(pool, (key) => itemWeight(stats.items[key]), rng);
    if (next !== undefined) round.push(next);
  }
  return round;
}

export function applyDrillAnswer(
  stats: DrillStats,
  key: string,
  correct: boolean,
  isToneQuestion: boolean,
  now: number,
): DrillStats {
  const items = { ...stats.items, [key]: updateItemStat(stats.items[key], correct, now) };
  if (!isToneQuestion) return { ...stats, items };
  return {
    items,
    toneCorrectTotal: stats.toneCorrectTotal + (correct ? 1 : 0),
    toneRecent: [...stats.toneRecent, correct ? 1 : 0].slice(-TONE_RECENT_LIMIT),
  };
}

/** 15 XP per round, +10 with at least 90% correct. */
export function roundXp(correct: number, total: number): number {
  return XP_RULES['drill-round'].amount + (total > 0 && correct / total >= 0.9 ? DRILL_ROUND_BONUS : 0);
}
