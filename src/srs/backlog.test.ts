import { describe, expect, it } from 'vitest';
import type { Card } from '@/domain/types';
import { planBacklogSpread } from './backlog';
import { DAY_MS } from './scheduler';

const NOW = Date.UTC(2026, 0, 20, 8);

function card(id: string, dueOffsetDays: number, state: Card['state'] = 'review'): Card {
  return {
    id,
    subjectType: 'word',
    subjectId: id,
    facet: 'read',
    state,
    repetition: 3,
    easeFactor: 2.5,
    intervalDays: 3,
    due: NOW + dueOffsetDays * DAY_MS,
    lapses: 0,
  };
}

describe('planBacklogSpread', () => {
  it('does nothing when the backlog fits in one day', () => {
    const plan = planBacklogSpread([card('a', -3), card('b', -1)], { now: NOW, perDay: 5 });
    expect(plan).toMatchObject({ moved: 0, days: 1, overdue: 2 });
    expect(plan.updates).toEqual([]);
  });

  it('keeps the first day and pushes the rest, most overdue first', () => {
    const cards = [card('a', -5), card('b', -4), card('c', -3), card('d', -2)];
    const plan = planBacklogSpread(cards, { now: NOW, perDay: 2 });
    expect(plan).toMatchObject({ moved: 2, days: 2, overdue: 4 });
    expect(plan.updates).toEqual([
      { id: 'c', due: NOW + DAY_MS },
      { id: 'd', due: NOW + DAY_MS },
    ]);
  });

  it('never pushes a card past the limit', () => {
    const cards = Array.from({ length: 20 }, (_, index) => card(`c${index}`, -20 + index));
    const plan = planBacklogSpread(cards, { now: NOW, perDay: 1, maxDays: 3 });
    expect(plan.days).toBe(3);
    const latest = Math.max(...plan.updates.map((update) => update.due));
    expect(latest).toBe(NOW + 2 * DAY_MS);
  });

  it('leaves cards that are not due yet and suspended cards alone', () => {
    const plan = planBacklogSpread([card('future', 2), card('asleep', -4, 'suspended'), card('a', -1), card('b', -1)], {
      now: NOW,
      perDay: 1,
    });
    expect(plan.overdue).toBe(2);
    expect(plan.updates.map((update) => update.id)).toEqual(['b']);
  });

  it('handles an empty pile and a silly per-day value', () => {
    expect(planBacklogSpread([], { now: NOW, perDay: 10 })).toMatchObject({ moved: 0, overdue: 0, days: 1 });
    expect(planBacklogSpread([card('a', -1), card('b', -1)], { now: NOW, perDay: 0 }).moved).toBe(1);
  });
});
