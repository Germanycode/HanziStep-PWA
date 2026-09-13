import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import { updateSettings } from '@/db/settings';
import { newlyUnlockedBadges, type BadgeContext } from './badges';
import { getLevelInfo, minXpForLevel } from './levels';
import { evaluateBadges, recordActivity } from './recordActivity';
import { getProgressSnapshot } from './snapshot';
import { GAMIFICATION_KEY } from './state';
import { computeStreak } from './streak';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`progress-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

describe('levels', () => {
  it('uses minXp = 250 × (L − 1)²', () => {
    expect([1, 2, 3, 5, 10].map(minXpForLevel)).toEqual([0, 250, 1000, 4000, 20250]);
  });

  it('computes level progress like the English extension', () => {
    expect(getLevelInfo(0)).toMatchObject({ level: 1, title: 'Học trò', titleZh: '学童', progressPct: 0, nextLevel: 2 });
    expect(getLevelInfo(249)).toMatchObject({ level: 1, progressInLevel: 249, span: 250, progressPct: 99 });
    expect(getLevelInfo(250)).toMatchObject({ level: 2, title: 'Thư sinh', progressInLevel: 0 });
    expect(getLevelInfo(20_250)).toMatchObject({ level: 10, title: 'Hàn lâm', isMax: true, progressPct: 100 });
    expect(getLevelInfo(1e9).level).toBe(10);
    expect(getLevelInfo(-5).level).toBe(1);
  });
});

describe('computeStreak', () => {
  it('is zero without activity', () => {
    expect(computeStreak([], '2026-09-11')).toEqual({ current: 0, longest: 0, atRisk: false, activeToday: false });
  });

  it('counts a streak that includes today', () => {
    expect(computeStreak(['2026-09-09', '2026-09-10', '2026-09-11'], '2026-09-11')).toEqual({
      current: 3,
      longest: 3,
      atRisk: false,
      activeToday: true,
    });
  });

  it('keeps yesterday’s streak alive but at risk', () => {
    expect(computeStreak(['2026-09-09', '2026-09-10'], '2026-09-11')).toMatchObject({ current: 2, atRisk: true });
  });

  it('drops to zero after a missed day and remembers the longest run', () => {
    const days = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-08'];
    expect(computeStreak(days, '2026-09-11')).toEqual({ current: 0, longest: 5, atRisk: false, activeToday: false });
  });

  it('ignores duplicates and future days, and crosses month boundaries', () => {
    expect(computeStreak(['2026-09-01', '2026-08-31', '2026-09-01', '2026-09-05'], '2026-09-01')).toMatchObject({
      current: 2,
      longest: 2,
    });
  });
});

describe('recordActivity', () => {
  const at = (hour: number, minute = 0) => new Date(2026, 8, 11, hour, minute);

  it('awards XP, updates daily stats and counts the day for the streak', async () => {
    const database = freshDb();
    const result = await recordActivity({ kind: 'review-correct', counters: { answers: 1, correct: 1 }, now: at(9) }, database);
    expect(result).toMatchObject({ dayKey: '2026-09-11', xpAwarded: 15, capped: false, totalXp: 15, levelBefore: 1, levelAfter: 1 });
    expect(result.stats).toMatchObject({ xp: 15, learningXp: 15, answers: 1, correct: 1 });
    const snapshot = await getProgressSnapshot(database, at(20));
    expect(snapshot.streak).toMatchObject({ current: 1, activeToday: true });
  });

  it('stops rewarding after the daily cap', async () => {
    const database = freshDb();
    for (let i = 0; i < 20; i++) await recordActivity({ kind: 'save-word', now: at(10) }, database);
    const capped = await recordActivity({ kind: 'save-word', now: at(10) }, database);
    expect(capped).toMatchObject({ capped: true, xpAwarded: 0, totalXp: 200 });
    // Saving words gives XP but does not count as a learning day.
    expect(capped.stats.learningXp).toBe(0);
  });

  it('adds the daily-goal bonus exactly once', async () => {
    const database = freshDb();
    await updateSettings({ dailyGoalXp: 50 }, database);
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await recordActivity({ kind: 'review-correct', now: at(11, i) }, database));
    expect(results.map((r) => r.goalReachedNow)).toEqual([false, false, false, true, false]);
    expect(results[4]?.totalXp).toBe(5 * 15 + 20);
    expect(results[4]?.stats.xpByKind['daily-goal']).toBe(20);
  });

  it('respects dayStartHour and detects level-ups', async () => {
    const database = freshDb();
    await updateSettings({ dayStartHour: 3 }, database);
    const lateNight = await recordActivity({ kind: 'coach', amount: 260, now: new Date(2026, 8, 12, 2, 30) }, database);
    expect(lateNight.dayKey).toBe('2026-09-11');
    expect(lateNight).toMatchObject({ levelBefore: 1, levelAfter: 2 });
  });

  it('unlocks streak badges from stored daily stats', async () => {
    const database = freshDb();
    for (const day of [9, 10, 11]) {
      await recordActivity({ kind: 'drill-round', now: new Date(2026, 8, day, 20) }, database);
    }
    const gamification = (await database.kv.get(GAMIFICATION_KEY))?.value as { badges: string[] };
    expect(gamification.badges).toContain('streak_3');
    expect(await evaluateBadges(database, new Date(2026, 8, 11, 21))).toEqual([]);
  });
});

describe('newlyUnlockedBadges', () => {
  const base: BadgeContext = {
    words: 0,
    masteredWords: 0,
    totalReviews: 0,
    taggedWords: 0,
    streak: { current: 0, longest: 0, atRisk: false, activeToday: false },
    level: 1,
    pinyinLessonsCompleted: 0,
    totalPinyinLessons: 8,
    toneCorrectTotal: 0,
    toneRecentAccuracy: null,
    storiesCreated: 0,
    textsRead: 0,
    speakingAttempts: 0,
    coachSessions: 0,
    hsk1Complete: false,
  };

  it('returns only badges that are newly earned', () => {
    expect(newlyUnlockedBadges([], base)).toEqual([]);
    const context = { ...base, words: 55, pinyinLessonsCompleted: 8, toneCorrectTotal: 250, toneRecentAccuracy: 0.9 };
    expect(newlyUnlockedBadges(['first_word'], context)).toEqual(['vocab_50', 'pinyin_graduate', 'tone_ear']);
  });
});
