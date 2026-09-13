import type { XpKind } from '@/domain/types';

export interface XpRule {
  /** Default XP for one event; callers may pass a different amount (e.g. dictation 10 or 4). */
  amount: number;
  /** Maximum number of rewarded events per day. */
  dailyCap?: number;
  /** Whether this XP makes the day count for the streak. */
  countsForStreak: boolean;
}

/**
 * XP table (docs/PLAN.md §6.1). The English extension gave +10 per saved word,
 * +15/+5 per review answer and +30 per session; those values are kept, with
 * daily caps so repeated easy actions cannot farm levels.
 */
export const XP_RULES: Record<XpKind, XpRule> = {
  'save-word': { amount: 10, dailyCap: 20, countsForStreak: false },
  'learn-word': { amount: 5, countsForStreak: true },
  'review-correct': { amount: 15, countsForStreak: true },
  'review-wrong': { amount: 5, countsForStreak: true },
  'retry-correct': { amount: 3, countsForStreak: true },
  'session-complete': { amount: 30, dailyCap: 3, countsForStreak: true },
  'first-tag': { amount: 10, countsForStreak: false },
  'pinyin-lesson': { amount: 25, countsForStreak: true },
  'drill-round': { amount: 15, dailyCap: 10, countsForStreak: true },
  'text-read': { amount: 20, dailyCap: 5, countsForStreak: true },
  comprehension: { amount: 5, countsForStreak: true },
  dictation: { amount: 10, countsForStreak: true },
  speaking: { amount: 3, dailyCap: 30, countsForStreak: true },
  shadowing: { amount: 5, dailyCap: 20, countsForStreak: true },
  coach: { amount: 30, dailyCap: 2, countsForStreak: true },
  'daily-goal': { amount: 20, dailyCap: 1, countsForStreak: false },
};

/** Extra XP for a drill round with at least 90% correct answers. */
export const DRILL_ROUND_BONUS = 10;
