import {
  DAY_MS,
  INITIAL_EASE_FACTOR,
  LEARNING_STEP_DAYS,
  MAX_INTERVAL_DAYS,
  MIN_EASE_FACTOR,
  type Scheduler,
} from './scheduler';

/**
 * Exact port of the English extension's `updateSM2` (review/review.js):
 * - correct (q ≥ 3): rep 0 → 20 minutes, rep 1 → 1 day, rep ≥ 2 → max(1, round(interval × EF));
 * - wrong: rep 0, 20 minutes;
 * - the interval uses the ease factor from BEFORE this answer, then
 *   EF += 0.1 − (5 − q)(0.08 + (5 − q)·0.02), floored at 1.3;
 * - intervals are capped at 365 days.
 * The only addition is `lapses`, counted when a card that had been learned is failed.
 */
export const sm2: Scheduler = {
  id: 'sm2',

  initial(now) {
    return { repetition: 0, easeFactor: INITIAL_EASE_FACTOR, intervalDays: 0, due: now, lapses: 0 };
  },

  next(state, quality, now) {
    let repetition = state.repetition || 0;
    let intervalDays = state.intervalDays || 0;
    let lapses = state.lapses || 0;
    const easeFactor = state.easeFactor || INITIAL_EASE_FACTOR;

    if (quality >= 3) {
      if (repetition === 0) intervalDays = LEARNING_STEP_DAYS;
      else if (repetition === 1) intervalDays = 1;
      else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
      repetition += 1;
    } else {
      if (repetition > 0) lapses += 1;
      repetition = 0;
      intervalDays = LEARNING_STEP_DAYS;
    }

    const nextEase = Math.max(MIN_EASE_FACTOR, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);

    return { repetition, easeFactor: nextEase, intervalDays, due: now + intervalDays * DAY_MS, lapses };
  },
};
