import { addDays, dayDiff, type DayKey } from '@/lib/dayKey';

export interface StreakInfo {
  /** Consecutive active days ending today, or ending yesterday when today is not active yet. */
  current: number;
  longest: number;
  /** The streak is alive but today has no activity yet. */
  atRisk: boolean;
  activeToday: boolean;
}

/**
 * Computed from the list of active days every time it is read, so a missed day
 * shows 0 immediately. (The English app stored the streak and only updated it
 * after the next review, so a broken streak kept showing the old number.)
 */
export function computeStreak(activeDays: Iterable<DayKey>, today: DayKey): StreakInfo {
  const days = [...new Set(activeDays)].filter((day) => dayDiff(day, today) >= 0).sort();

  let longest = 0;
  let run = 0;
  let previous: DayKey | undefined;
  for (const day of days) {
    run = previous !== undefined && dayDiff(previous, day) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const active = new Set(days);
  const activeToday = active.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest, atRisk: current > 0 && !activeToday, activeToday };
}
