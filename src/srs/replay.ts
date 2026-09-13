import type { ReviewLog } from '@/domain/types';
import { DAY_MS, type SchedState, type Scheduler } from './scheduler';

/** The parts of a review log a scheduler needs; retries are not schedule events. */
export type ReplayLog = Pick<ReviewLog, 'quality' | 'reviewedAt' | 'mode'>;

export function schedulingLogs(logs: readonly ReplayLog[]): ReplayLog[] {
  return logs.filter((log) => log.mode !== 'retry').sort((a, b) => a.reviewedAt - b.reviewedAt);
}

/**
 * Replays one card's answers through a scheduler (docs/PLAN.md §10, Phase 5),
 * so two schedulers can be compared on the learner's real history without
 * touching the stored cards.
 */
export function replayCard(logs: readonly ReplayLog[], scheduler: Scheduler): SchedState | null {
  const ordered = schedulingLogs(logs);
  const first = ordered[0];
  if (!first) return null;

  let state = scheduler.initial(first.reviewedAt);
  for (const log of ordered) state = { ...scheduler.next(state, log.quality, log.reviewedAt), lastReviewedAt: log.reviewedAt };
  return state;
}

export interface ReplaySummary {
  cards: number;
  answers: number;
  /** Mean interval in days at the end of the history. */
  averageIntervalDays: number;
  /** Cards whose next review would fall within a day. */
  dueWithinADay: number;
  longestIntervalDays: number;
}

export function summarise(states: readonly SchedState[], now: number): ReplaySummary {
  if (states.length === 0) return { cards: 0, answers: 0, averageIntervalDays: 0, dueWithinADay: 0, longestIntervalDays: 0 };
  const intervals = states.map((state) => state.intervalDays);
  return {
    cards: states.length,
    answers: 0,
    averageIntervalDays: intervals.reduce((total, value) => total + value, 0) / states.length,
    dueWithinADay: states.filter((state) => state.due - now <= DAY_MS).length,
    longestIntervalDays: Math.max(...intervals),
  };
}

export interface SchedulerComparison {
  now: number;
  byScheduler: { id: Scheduler['id']; summary: ReplaySummary }[];
}

/** Replays every card's history through each scheduler and summarises the result. */
export function compareSchedulers(
  histories: readonly (readonly ReplayLog[])[],
  schedulers: readonly Scheduler[],
  now = Date.now(),
): SchedulerComparison {
  const answers = histories.reduce((total, logs) => total + schedulingLogs(logs).length, 0);
  return {
    now,
    byScheduler: schedulers.map((scheduler) => {
      const states = histories.flatMap((logs) => {
        const state = replayCard(logs, scheduler);
        return state ? [state] : [];
      });
      return { id: scheduler.id, summary: { ...summarise(states, now), answers } };
    }),
  };
}
