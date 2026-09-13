import { describe, expect, it } from 'vitest';
import type { Quality } from '@/domain/types';
import { fsrsScheduler } from './fsrs';
import { compareSchedulers, replayCard, schedulingLogs, type ReplayLog } from './replay';
import { DAY_MS, MAX_INTERVAL_DAYS, type SchedState } from './scheduler';
import { schedulerFor } from './schedulers';
import { sm2 } from './sm2';

const START = Date.UTC(2026, 0, 1, 8);

function answer(state: SchedState, quality: Quality, at: number): SchedState {
  return fsrsScheduler.next(state, quality, at);
}

describe('fsrsScheduler', () => {
  it('starts a new card due immediately, with memory state only after the first review', () => {
    const state = fsrsScheduler.initial(START);
    expect(state).toMatchObject({ repetition: 0, intervalDays: 0, due: START, lapses: 0 });
    expect(state.fsrs).toBeUndefined();

    const reviewed = answer(state, 4, START);
    expect(reviewed.fsrs?.stability).toBeGreaterThan(0);
    expect(reviewed.fsrs?.difficulty).toBeGreaterThan(0);
  });

  it('keeps the first correct answer inside a day and grows from there', () => {
    const first = answer(fsrsScheduler.initial(START), 4, START);
    expect(first.repetition).toBe(1);
    expect(first.intervalDays).toBeLessThan(1);

    const second = answer(first, 4, first.due);
    const third = answer(second, 4, second.due);
    expect(third.intervalDays).toBeGreaterThan(second.intervalDays);
    expect(third.fsrs?.stability).toBeGreaterThan(0);
  });

  it('counts a lapse and shortens the interval after a wrong answer', () => {
    let state = answer(fsrsScheduler.initial(START), 4, START);
    for (let index = 0; index < 4; index++) state = answer(state, 4, state.due);
    expect(state.intervalDays).toBeGreaterThan(1);

    const lapsed = answer(state, 0, state.due);
    expect(lapsed.lapses).toBe(state.lapses + 1);
    expect(lapsed.intervalDays).toBeLessThan(state.intervalDays);
  });

  it('never turns repeated Again answers into successful mastery', () => {
    let state = fsrsScheduler.initial(START);
    for (let index = 0; index < 4; index++) {
      state = answer(state, 0, state.due);
      expect(state.repetition).toBe(0);
    }
    expect(state.fsrs?.reps).toBe(4);
  });

  it('never schedules further out than the app promises', () => {
    let state = answer(fsrsScheduler.initial(START), 5, START);
    for (let index = 0; index < 30; index++) state = answer(state, 5, state.due);
    expect(state.intervalDays).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
  });

  it('seeds a mature imported SM-2 interval instead of collapsing it', () => {
    const mature: SchedState = {
      repetition: 5,
      easeFactor: 2.5,
      intervalDays: 20,
      due: START,
      lastReviewedAt: START - 20 * DAY_MS,
      lapses: 0,
    };
    const viaFsrs = fsrsScheduler.next(mature, 4, START);
    expect(viaFsrs.easeFactor).toBe(mature.easeFactor);
    expect(viaFsrs.intervalDays).toBeGreaterThanOrEqual(mature.intervalDays);
  });

  it('is registered and deterministic', () => {
    expect(schedulerFor('fsrs')).toBe(fsrsScheduler);
    expect(schedulerFor('sm2')).toBe(sm2);
    const a = answer(fsrsScheduler.initial(START), 3, START);
    const b = answer(fsrsScheduler.initial(START), 3, START);
    expect(a).toEqual(b);
  });
});

describe('replay', () => {
  const logs: ReplayLog[] = [
    { quality: 4, reviewedAt: START + 2 * DAY_MS, mode: 'review' },
    { quality: 5, reviewedAt: START, mode: 'learn' },
    { quality: 1, reviewedAt: START + DAY_MS, mode: 'retry' },
    { quality: 3, reviewedAt: START + 5 * DAY_MS, mode: 'review' },
  ];

  it('orders answers and drops retries, which never change the schedule', () => {
    expect(schedulingLogs(logs).map((log) => log.reviewedAt)).toEqual([START, START + 2 * DAY_MS, START + 5 * DAY_MS]);
  });

  it('returns null for a card with no scheduling answers', () => {
    expect(replayCard([{ quality: 4, reviewedAt: START, mode: 'retry' }], sm2)).toBeNull();
    expect(replayCard([], fsrsScheduler)).toBeNull();
  });

  it('replays the same history through both schedulers', () => {
    const bySm2 = replayCard(logs, sm2);
    const byFsrs = replayCard(logs, fsrsScheduler);
    expect(bySm2?.repetition).toBe(3);
    expect(byFsrs?.repetition).toBe(3);
    expect(byFsrs?.fsrs?.stability).toBeGreaterThan(0);
    expect(bySm2?.fsrs).toBeUndefined();
  });

  it('summarises a comparison over several cards', () => {
    const comparison = compareSchedulers([logs, logs], [sm2, fsrsScheduler], START + 6 * DAY_MS);
    expect(comparison.byScheduler.map((entry) => entry.id)).toEqual(['sm2', 'fsrs']);
    for (const entry of comparison.byScheduler) {
      expect(entry.summary.cards).toBe(2);
      expect(entry.summary.answers).toBe(6);
      expect(entry.summary.averageIntervalDays).toBeGreaterThan(0);
    }
  });
});
