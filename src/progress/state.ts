import type { DailyStats, GamificationState } from '@/domain/types';
import type { DayKey } from '@/lib/dayKey';

/** kv keys owned by the progress system. */
export const GAMIFICATION_KEY = 'gamification';
export const PINYIN_PROGRESS_KEY = 'pinyinProgress';
export const DRILL_STATS_KEY = 'drillStats';

export interface PinyinProgress {
  completedLessons: string[];
}

export interface DrillItemStat {
  /** Running error rate (exponential moving average, 0 = always right, 1 = always wrong). */
  ema: number;
  attempts: number;
  lastAt: number;
}

export interface DrillStats {
  items: Record<string, DrillItemStat>;
  /** Correct answers to tone questions, all time. */
  toneCorrectTotal: number;
  /** Last 100 tone answers, 1 = correct, oldest first. */
  toneRecent: number[];
}

export function emptyDailyStats(dayKey: DayKey): DailyStats {
  return {
    dayKey,
    xp: 0,
    learningXp: 0,
    xpByKind: {},
    eventsByKind: {},
    answers: 0,
    correct: 0,
    newIntroduced: 0,
    textsRead: 0,
    dictations: 0,
    speakingAttempts: 0,
    drillItems: 0,
    coachSeconds: 0,
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function normalizeGamification(raw: unknown): GamificationState {
  const value = asRecord(raw);
  const xp = typeof value.xp === 'number' && Number.isFinite(value.xp) && value.xp > 0 ? Math.floor(value.xp) : 0;
  const badges = Array.isArray(value.badges) ? value.badges.filter((badge): badge is string => typeof badge === 'string') : [];
  return { xp, badges };
}

export function normalizePinyinProgress(raw: unknown): PinyinProgress {
  const value = asRecord(raw);
  const lessons = Array.isArray(value.completedLessons) ? value.completedLessons : [];
  return { completedLessons: lessons.filter((id): id is string => typeof id === 'string') };
}

export function normalizeDrillStats(raw: unknown): DrillStats {
  const value = asRecord(raw);
  const items: Record<string, DrillItemStat> = {};
  for (const [key, stat] of Object.entries(asRecord(value.items))) {
    const item = asRecord(stat);
    if (typeof item.ema === 'number' && typeof item.attempts === 'number') {
      items[key] = { ema: item.ema, attempts: item.attempts, lastAt: typeof item.lastAt === 'number' ? item.lastAt : 0 };
    }
  }
  return {
    items,
    toneCorrectTotal: typeof value.toneCorrectTotal === 'number' ? value.toneCorrectTotal : 0,
    toneRecent: Array.isArray(value.toneRecent) ? value.toneRecent.filter((n): n is number => n === 0 || n === 1) : [],
  };
}
