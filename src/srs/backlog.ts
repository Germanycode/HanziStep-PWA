import type { Card } from '@/domain/types';
import { DAY_MS } from './scheduler';

export interface SpreadOptions {
  now: number;
  /** How many overdue cards to keep for each day. */
  perDay: number;
  /** Slots still available today; may be zero when the daily cap was reached. */
  todayCapacity?: number;
  /** Never push a card further than this many days out. */
  maxDays?: number;
}

export interface SpreadPlan {
  updates: { id: string; due: number }[];
  /** How many days the backlog will span, today included. */
  days: number;
  moved: number;
  overdue: number;
}

export const DEFAULT_MAX_SPREAD_DAYS = 14;

/**
 * Spreads a pile of overdue cards over the coming days (docs/PLAN.md §9,
 * Phase 5). The most overdue cards stay first; nothing that is not yet due is
 * touched, and no card is ever pushed further than `maxDays`.
 */
export function planBacklogSpread(cards: readonly Card[], options: SpreadOptions): SpreadPlan {
  const perDay = Math.max(1, Math.floor(options.perDay));
  const maxDays = Math.max(1, Math.floor(options.maxDays ?? DEFAULT_MAX_SPREAD_DAYS));
  const todayCapacity = Math.max(0, Math.floor(options.todayCapacity ?? perDay));
  const overdue = cards.filter((card) => card.state !== 'suspended' && card.due <= options.now).sort((a, b) => a.due - b.due);

  const updates: { id: string; due: number }[] = [];
  let lastDay = 0;
  overdue.forEach((card, index) => {
    const day = index < todayCapacity ? 0 : Math.min(maxDays - 1, 1 + Math.floor((index - todayCapacity) / perDay));
    lastDay = Math.max(lastDay, day);
    // The first day's share keeps today's date; only the rest moves.
    if (day > 0) updates.push({ id: card.id, due: options.now + day * DAY_MS });
  });

  return { updates, days: lastDay + 1, moved: updates.length, overdue: overdue.length };
}
