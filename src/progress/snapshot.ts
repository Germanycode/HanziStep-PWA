import { useLiveQuery } from 'dexie-react-hooks';
import { useNow } from '@/lib/useNow';
import { db, type HanziStepDB } from '@/db/db';
import { normalizeSettings, SETTINGS_KEY } from '@/db/settings';
import type { DailyStats } from '@/domain/types';
import { toDayKey } from '@/lib/dayKey';
import { getLevelInfo, type LevelInfo } from './levels';
import { emptyDailyStats, GAMIFICATION_KEY, normalizeGamification } from './state';
import { computeStreak, type StreakInfo } from './streak';

export interface GoalProgress {
  xp: number;
  goal: number;
  pct: number;
  met: boolean;
}

export interface ProgressSnapshot {
  level: LevelInfo;
  streak: StreakInfo;
  today: DailyStats;
  goal: GoalProgress;
  badges: string[];
}

/** Progress towards the daily goal, measured in learning XP (see recordActivity). */
export function goalProgress(stats: DailyStats, goalXp: number): GoalProgress {
  return {
    xp: stats.learningXp,
    goal: goalXp,
    pct: goalXp > 0 ? Math.min(100, Math.round((stats.learningXp / goalXp) * 100)) : 100,
    met: Boolean(stats.goalMetAt) || stats.learningXp >= goalXp,
  };
}

export async function getProgressSnapshot(database: HanziStepDB = db, now: Date = new Date()): Promise<ProgressSnapshot> {
  const [settingsRow, gamificationRow, allStats] = await Promise.all([
    database.kv.get(SETTINGS_KEY),
    database.kv.get(GAMIFICATION_KEY),
    database.dailyStats.toArray(),
  ]);
  const settings = normalizeSettings(settingsRow?.value);
  const gamification = normalizeGamification(gamificationRow?.value);
  const todayKey = toDayKey(now, settings.dayStartHour);
  const today = allStats.find((stats) => stats.dayKey === todayKey) ?? emptyDailyStats(todayKey);
  return {
    level: getLevelInfo(gamification.xp),
    streak: computeStreak(
      allStats.filter((stats) => stats.learningXp > 0).map((stats) => stats.dayKey),
      todayKey,
    ),
    today,
    goal: goalProgress(today, settings.dailyGoalXp),
    badges: gamification.badges,
  };
}

/** Live progress for the UI; undefined while loading. */
export function useProgress(): ProgressSnapshot | undefined {
  const now = useNow(60_000);
  return useLiveQuery(() => getProgressSnapshot(db, new Date(now)), [now]);
}
