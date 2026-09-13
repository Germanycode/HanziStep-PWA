import type { Card, Quality } from '@/domain/types';

export const DAY_MS = 86_400_000;
/** First step for new and failed cards: 20 minutes, as in the English extension. */
export const LEARNING_STEP_DAYS = 20 / (24 * 60);
export const MAX_INTERVAL_DAYS = 365;
export const MIN_EASE_FACTOR = 1.3;
export const INITIAL_EASE_FACTOR = 2.5;

/**
 * What a scheduler reads and writes. `fsrs` and `lastReviewedAt` are optional:
 * SM-2 ignores them, and leaving them untouched is what lets the learner switch
 * scheduler without losing either algorithm's state.
 */
export type SchedState = Pick<Card, 'repetition' | 'easeFactor' | 'intervalDays' | 'due' | 'lapses' | 'fsrs' | 'lastReviewedAt'>;

/** Every scheduler (SM-2 now, FSRS later) implements this, so the rest of the app never depends on the algorithm. */
export interface Scheduler {
  id: 'sm2' | 'fsrs';
  initial(now: number): SchedState;
  next(state: SchedState, quality: Quality, now: number): SchedState;
}

/** FSRS-style rating (Again/Hard/Good/Easy), logged from day one so reviews can be replayed later. */
export function toRating(quality: Quality): 1 | 2 | 3 | 4 {
  if (quality <= 2) return 1;
  if (quality === 3) return 2;
  if (quality === 4) return 3;
  return 4;
}
