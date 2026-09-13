import { describe, expect, it } from 'vitest';
import type { Quality } from '@/domain/types';
import { createCard, masteryLabel, scheduleCard } from './cards';
import { DAY_MS, LEARNING_STEP_DAYS, toRating } from './scheduler';
import { sm2 } from './sm2';

describe('SM-2 port (golden table from docs/PLAN.md §5.2)', () => {
  const steps: { q: Quality; interval: number; rep: number; ef: number; lapses: number }[] = [
    { q: 4, interval: LEARNING_STEP_DAYS, rep: 1, ef: 2.5, lapses: 0 },
    { q: 4, interval: 1, rep: 2, ef: 2.5, lapses: 0 },
    { q: 4, interval: 3, rep: 3, ef: 2.5, lapses: 0 },
    { q: 5, interval: 8, rep: 4, ef: 2.6, lapses: 0 },
    { q: 3, interval: 21, rep: 5, ef: 2.46, lapses: 0 },
    { q: 0, interval: LEARNING_STEP_DAYS, rep: 0, ef: 1.66, lapses: 1 },
    { q: 1, interval: LEARNING_STEP_DAYS, rep: 0, ef: 1.3, lapses: 1 },
  ];

  it('reproduces every step', () => {
    let state = sm2.initial(0);
    let now = 1_000_000;
    for (const step of steps) {
      state = sm2.next(state, step.q, now);
      expect(state.intervalDays).toBeCloseTo(step.interval, 10);
      expect(state.repetition).toBe(step.rep);
      expect(state.easeFactor).toBeCloseTo(step.ef, 10);
      expect(state.lapses).toBe(step.lapses);
      expect(state.due).toBeCloseTo(now + step.interval * DAY_MS, 0);
      now = state.due;
    }
  });

  it('starts new cards due now and caps intervals at 365 days', () => {
    expect(sm2.initial(42)).toEqual({ repetition: 0, easeFactor: 2.5, intervalDays: 0, due: 42, lapses: 0 });
    const next = sm2.next({ repetition: 9, easeFactor: 3, intervalDays: 300, due: 0, lapses: 0 }, 5, 0);
    expect(next.intervalDays).toBe(365);
  });

  it('keeps imported cards without an interval moving (at least one day)', () => {
    expect(sm2.next({ repetition: 3, easeFactor: 2.5, intervalDays: 0, due: 0, lapses: 0 }, 4, 0).intervalDays).toBe(1);
  });

  it('maps quality to FSRS ratings', () => {
    expect(([0, 1, 2, 3, 4, 5] as Quality[]).map(toRating)).toEqual([1, 1, 1, 2, 3, 4]);
  });
});

describe('card states', () => {
  it('moves through learning, review and relearning', () => {
    let card = createCard('w1', 'read', 0);
    expect(card).toMatchObject({ id: 'read:w1', state: 'new', due: 0 });
    card = scheduleCard(card, 4, 1000);
    expect(card.state).toBe('learning');
    card = scheduleCard(card, 4, 2000);
    expect(card.state).toBe('review');
    card = scheduleCard(card, 0, 3000);
    expect(card).toMatchObject({ state: 'relearning', lapses: 1, lastReviewedAt: 3000 });
    card = scheduleCard(card, 1, 4000);
    expect(card.state).toBe('relearning');
  });

  it('keeps suspended cards suspended until unlocked and labels mastery', () => {
    expect(createCard('w1', 'listen', 0, true).state).toBe('suspended');
    expect([0, 1, 2, 3, 4, 9].map(masteryLabel)).toEqual(['Mới', 'Đang học', 'Quen', 'Nhớ', 'Thành thạo', 'Thành thạo']);
  });
});
