import { createEmptyCard, fsrs as createFsrs, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { Quality } from '@/domain/types';
import { DAY_MS, INITIAL_EASE_FACTOR, MAX_INTERVAL_DAYS, toRating, type SchedState, type Scheduler } from './scheduler';

/**
 * Optional FSRS scheduler (docs/PLAN.md §9, Phase 5).
 *
 * It stores its memory state in `card.fsrs` and never touches `easeFactor`, so
 * switching back to SM-2 finds the old schedule exactly as it was.
 */
const engine = createFsrs({
  // The app promises intervals of at most a year, like the SM-2 port.
  maximum_interval: MAX_INTERVAL_DAYS,
  // Deterministic: the same answers must always produce the same schedule.
  enable_fuzz: false,
});

function stateOf(state: SchedState): State {
  // FSRS only gains memory state on the first real review: stability 0 still means "new".
  const reviewed = (state.fsrs?.stability ?? 0) > 0;
  if (state.repetition <= 0 && !reviewed) return State.New;
  if (state.intervalDays >= 1) return State.Review;
  return state.lapses > 0 && state.repetition === 0 ? State.Relearning : State.Learning;
}

function toFsrsCard(state: SchedState, now: number): FsrsCard {
  const empty = createEmptyCard(new Date(now));
  const lastReview = state.lastReviewedAt ?? undefined;
  return {
    ...empty,
    due: new Date(state.due),
    // A reviewed card imported from SM-2 may have no FSRS memory yet. Seeding
    // stability from its current interval avoids collapsing a mature card to
    // a one-day schedule on the first FSRS answer.
    stability: state.fsrs?.stability ?? (state.intervalDays >= 1 ? state.intervalDays : empty.stability),
    difficulty: state.fsrs?.difficulty ?? (state.intervalDays >= 1 ? 5 : empty.difficulty),
    elapsed_days: lastReview === undefined ? 0 : Math.max(0, (now - lastReview) / DAY_MS),
    scheduled_days: Math.max(0, Math.round(state.intervalDays)),
    reps: Math.max(0, state.fsrs?.reps ?? state.repetition),
    lapses: Math.max(0, state.fsrs?.lapses ?? state.lapses),
    // Restore the library's own bookkeeping; only guess when the card comes from SM-2.
    learning_steps: state.fsrs?.learningSteps ?? empty.learning_steps,
    state: (state.fsrs?.state as State | undefined) ?? stateOf(state),
    ...(lastReview === undefined ? {} : { last_review: new Date(lastReview) }),
  };
}

export const fsrsScheduler: Scheduler = {
  id: 'fsrs',

  initial(now) {
    return {
      repetition: 0,
      // Kept so a switch back to SM-2 starts from the usual ease.
      easeFactor: INITIAL_EASE_FACTOR,
      intervalDays: 0,
      due: now,
      lapses: 0,
      // No memory state yet: FSRS assigns stability and difficulty at the first review.
    };
  },

  next(state: SchedState, quality: Quality, now: number): SchedState {
    const { card } = engine.next(toFsrsCard(state, now), new Date(now), toRating(quality) as Grade);
    const due = card.due.getTime();
    const correct = quality >= 3;
    return {
      // Domain repetition means consecutive successful reviews. The library's
      // total attempts live in fsrs.reps and must never unlock mastery on Again.
      repetition: correct ? state.repetition + 1 : 0,
      easeFactor: state.easeFactor,
      intervalDays: Math.min(MAX_INTERVAL_DAYS, Math.max(0, (due - now) / DAY_MS)),
      due,
      lapses: !correct && state.repetition > 0 ? state.lapses + 1 : state.lapses,
      fsrs: {
        stability: card.stability,
        difficulty: card.difficulty,
        learningSteps: card.learning_steps,
        state: card.state,
        reps: card.reps,
        lapses: card.lapses,
      },
      lastReviewedAt: now,
    };
  },
};
