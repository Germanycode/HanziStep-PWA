import { db, type HanziStepDB } from '@/db/db';
import { normalizeSettings, SETTINGS_KEY } from '@/db/settings';
import type { DailyStats, XpKind } from '@/domain/types';
import { toDayKey, type DayKey } from '@/lib/dayKey';
import { newlyUnlockedBadges, type BadgeContext } from './badges';
import { getLevelInfo } from './levels';
import {
  DRILL_STATS_KEY,
  emptyDailyStats,
  GAMIFICATION_KEY,
  normalizeDrillStats,
  normalizeGamification,
  normalizePinyinProgress,
  PINYIN_PROGRESS_KEY,
} from './state';
import { computeStreak } from './streak';
import { XP_RULES } from './xp';
import { HSK_LEVEL_ONE_COUNTS, levelOf } from '@/data/hsk';

export type DailyCounter =
  | 'answers'
  | 'correct'
  | 'newIntroduced'
  | 'textsRead'
  | 'dictations'
  | 'speakingAttempts'
  | 'drillItems'
  | 'coachSeconds';

export interface ActivityInput {
  kind: XpKind;
  /** Overrides the rule's default amount (e.g. a drill round with bonus). */
  amount?: number;
  counters?: Partial<Record<DailyCounter, number>>;
  now?: Date;
}

export interface ActivityResult {
  dayKey: DayKey;
  xpAwarded: number;
  /** The daily cap for this kind was already reached, so no XP was given. */
  capped: boolean;
  goalReachedNow: boolean;
  goalBonus: number;
  totalXp: number;
  levelBefore: number;
  levelAfter: number;
  stats: DailyStats;
  newBadges: string[];
}

/** Number of pinyin lessons in the course; set by the pinyin feature (kept here to avoid an import cycle). */
export const TOTAL_PINYIN_LESSONS = 8;

export type AppliedActivity = Omit<ActivityResult, 'newBadges'>;

/**
 * Records one learning activity: daily stats, XP with daily caps, the daily
 * goal bonus (once per day) and badges. Everything except badge evaluation
 * happens in one transaction.
 */
export async function recordActivity(input: ActivityInput, database: HanziStepDB = db): Promise<ActivityResult> {
  const now = input.now ?? new Date();
  const result = await database.transaction('rw', [database.dailyStats, database.kv], () =>
    applyActivity(database, { ...input, now }),
  );
  const newBadges = await evaluateBadges(database, now);
  return { ...result, newBadges };
}

/**
 * The transactional part of `recordActivity`. Must run inside a transaction
 * that includes `dailyStats` and `kv` (e.g. answerCard's), and does not
 * evaluate badges — callers do that after the commit.
 */
export async function applyActivity(database: HanziStepDB, input: ActivityInput): Promise<AppliedActivity> {
  const now = input.now ?? new Date();
  {
    const settings = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
    const dayKey = toDayKey(now, settings.dayStartHour);
    const stats = (await database.dailyStats.get(dayKey)) ?? emptyDailyStats(dayKey);
    stats.eventsByKind ??= {};

    const rule = XP_RULES[input.kind];
    const events = stats.eventsByKind[input.kind] ?? 0;
    const capped = rule.dailyCap !== undefined && events >= rule.dailyCap;
    const xpAwarded = capped ? 0 : Math.max(0, Math.round(input.amount ?? rule.amount));

    stats.eventsByKind[input.kind] = events + 1;
    stats.xp += xpAwarded;
    stats.xpByKind[input.kind] = (stats.xpByKind[input.kind] ?? 0) + xpAwarded;
    if (rule.countsForStreak) stats.learningXp += xpAwarded;
    for (const [counter, value] of Object.entries(input.counters ?? {}) as [DailyCounter, number][]) {
      stats[counter] += value;
    }

    const gamification = normalizeGamification((await database.kv.get(GAMIFICATION_KEY))?.value);
    const levelBefore = getLevelInfo(gamification.xp).level;
    gamification.xp += xpAwarded;

    let goalBonus = 0;
    // The goal counts learning XP only, like the streak: saving words alone does not complete it.
    if (!stats.goalMetAt && input.kind !== 'daily-goal' && stats.learningXp >= settings.dailyGoalXp) {
      goalBonus = XP_RULES['daily-goal'].amount;
      stats.goalMetAt = now.getTime();
      stats.xp += goalBonus;
      stats.xpByKind['daily-goal'] = (stats.xpByKind['daily-goal'] ?? 0) + goalBonus;
      stats.eventsByKind['daily-goal'] = (stats.eventsByKind['daily-goal'] ?? 0) + 1;
      gamification.xp += goalBonus;
    }

    await database.dailyStats.put(stats);
    await database.kv.put({ key: GAMIFICATION_KEY, value: gamification });

    return {
      dayKey,
      xpAwarded,
      capped,
      goalReachedNow: goalBonus > 0,
      goalBonus,
      totalXp: gamification.xp,
      levelBefore,
      levelAfter: getLevelInfo(gamification.xp).level,
      stats,
    };
  }
}

export async function buildBadgeContext(database: HanziStepDB, now: Date = new Date()): Promise<BadgeContext> {
  const settings = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
  const today = toDayKey(now, settings.dayStartHour);
  const [wordRows, readCards, taggedWords, totalReviews, allStats, gamificationRow, pinyinRow, drillRow, storiesCreated, coachSessions] =
    await Promise.all([
      database.words.toArray(),
      database.cards.where('facet').equals('read').toArray(),
      database.words.filter((word) => word.tags.length > 0).count(),
      database.reviewLogs.filter((log) => log.mode === 'review' || log.mode === 'learn').count(),
      database.dailyStats.toArray(),
      database.kv.get(GAMIFICATION_KEY),
      database.kv.get(PINYIN_PROGRESS_KEY),
      database.kv.get(DRILL_STATS_KEY),
      database.texts.where('kind').equals('ai-story').count(),
      database.coachSessions.count(),
    ]);

  const drillStats = normalizeDrillStats(drillRow?.value);
  const recent = drillStats.toneRecent;
  const introduced = new Set(readCards.map((card) => card.subjectId));
  const learnedHeadwords = new Set(
    wordRows.filter((word) => word.knownWithoutSrs || introduced.has(word.id)).map((word) => word.simplified),
  );
  const hsk1Learned = new Set(
    wordRows
      .filter((word) => levelOf(word.hsk, settings.hskTrack) === 1 && learnedHeadwords.has(word.simplified))
      .map((word) => word.simplified),
  );
  return {
    words: wordRows.length,
    masteredWords: readCards.filter((card) => card.repetition >= 4).length,
    totalReviews,
    taggedWords,
    streak: computeStreak(
      allStats.filter((stats) => stats.learningXp > 0).map((stats) => stats.dayKey),
      today,
    ),
    level: getLevelInfo(normalizeGamification(gamificationRow?.value).xp).level,
    pinyinLessonsCompleted: normalizePinyinProgress(pinyinRow?.value).completedLessons.length,
    totalPinyinLessons: TOTAL_PINYIN_LESSONS,
    toneCorrectTotal: drillStats.toneCorrectTotal,
    toneRecentAccuracy: recent.length >= 100 ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null,
    storiesCreated,
    textsRead: allStats.reduce((sum, stats) => sum + stats.textsRead, 0),
    speakingAttempts: allStats.reduce((sum, stats) => sum + stats.speakingAttempts, 0),
    coachSessions,
    hsk1Complete: hsk1Learned.size >= HSK_LEVEL_ONE_COUNTS[settings.hskTrack],
  };
}

/** Unlocks any badge whose condition is now met; returns the new badge ids. */
export async function evaluateBadges(database: HanziStepDB = db, now: Date = new Date()): Promise<string[]> {
  const context = await buildBadgeContext(database, now);
  return database.transaction('rw', database.kv, async () => {
    const gamification = normalizeGamification((await database.kv.get(GAMIFICATION_KEY))?.value);
    const unlocked = newlyUnlockedBadges(gamification.badges, context);
    if (unlocked.length > 0) {
      gamification.badges = [...gamification.badges, ...unlocked];
      await database.kv.put({ key: GAMIFICATION_KEY, value: gamification });
    }
    return unlocked;
  });
}
