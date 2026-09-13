import type { HskWordRecord } from '@/data/types';
import type { Card, DailyStats, Facet, Word } from '@/domain/types';
import { wordKey } from '@/features/review/engine/session';
import { posLabel } from '@/features/vocab/wordFactory';
import { lastNDays, type DayKey } from '@/lib/dayKey';
import { MASTERY_LABELS, masteryLevel } from '@/srs/cards';

export const HEATMAP_DAYS = 98;
/** XP thresholds for the four shades of the heatmap. */
const HEAT_STEPS = [50, 150, 300];

export interface HeatCell {
  dayKey: DayKey;
  xp: number;
  answers: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function heatLevel(xp: number): HeatCell['level'] {
  if (xp <= 0) return 0;
  if (xp < (HEAT_STEPS[0] ?? 50)) return 1;
  if (xp < (HEAT_STEPS[1] ?? 150)) return 2;
  if (xp < (HEAT_STEPS[2] ?? 300)) return 3;
  return 4;
}

/** Oldest day first, so the grid can be filled column by column. */
export function buildHeatmap(stats: readonly DailyStats[], today: DayKey, days = HEATMAP_DAYS): HeatCell[] {
  const byDay = new Map(stats.map((entry) => [entry.dayKey, entry]));
  return lastNDays(today, days).map((dayKey) => {
    const entry = byDay.get(dayKey);
    const xp = entry?.xp ?? 0;
    return { dayKey, xp, answers: entry?.answers ?? 0, level: heatLevel(xp) };
  });
}

export interface Totals {
  xp: number;
  answers: number;
  correct: number;
  /** 0–1; 0 when nothing has been answered. */
  accuracy: number;
  newIntroduced: number;
  activeDays: number;
}

export function sumTotals(stats: readonly DailyStats[]): Totals {
  const totals = stats.reduce(
    (acc, entry) => ({
      xp: acc.xp + entry.xp,
      answers: acc.answers + entry.answers,
      correct: acc.correct + entry.correct,
      newIntroduced: acc.newIntroduced + entry.newIntroduced,
      activeDays: acc.activeDays + (entry.learningXp > 0 ? 1 : 0),
    }),
    { xp: 0, answers: 0, correct: 0, newIntroduced: 0, activeDays: 0 },
  );
  return { ...totals, accuracy: totals.answers > 0 ? totals.correct / totals.answers : 0 };
}

export interface FacetMastery {
  facet: Facet;
  /** Cards per mastery level, index 0–4 (Mới … Thành thạo). */
  counts: number[];
  suspended: number;
  total: number;
}

export function masteryByFacet(cards: readonly Card[]): FacetMastery[] {
  const byFacet = new Map<Facet, FacetMastery>();
  for (const card of cards) {
    const entry = byFacet.get(card.facet) ?? {
      facet: card.facet,
      counts: MASTERY_LABELS.map(() => 0),
      suspended: 0,
      total: 0,
    };
    if (card.state === 'suspended') entry.suspended++;
    else {
      const level = masteryLevel(card.repetition);
      entry.counts[level] = (entry.counts[level] ?? 0) + 1;
    }
    entry.total++;
    byFacet.set(card.facet, entry);
  }
  const order: Facet[] = ['read', 'listen', 'speak', 'write'];
  return order.flatMap((facet) => {
    const entry = byFacet.get(facet);
    return entry ? [entry] : [];
  });
}

export interface PosCount {
  code: string;
  label: string;
  count: number;
}

/** Most common parts of speech among saved words (a word counts once per code). */
export function posBreakdown(words: readonly Word[], limit = 8): PosCount[] {
  const counts = new Map<string, number>();
  for (const word of words) {
    for (const code of new Set(word.pos)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: posLabel(code), count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, limit);
}

export interface LevelProgress {
  level: number;
  total: number;
  owned: number;
  pct: number;
}

/** How many words of an HSK level are already saved, matched by characters + pinyin. */
export function levelProgress(level: number, records: readonly HskWordRecord[], owned: ReadonlySet<string>): LevelProgress {
  let count = 0;
  for (const record of records) {
    const form = record.f[0];
    if (form && owned.has(wordKey(record.s, form.pn))) count++;
  }
  return { level, total: records.length, owned: count, pct: records.length > 0 ? Math.round((count / records.length) * 100) : 0 };
}

export function ownedWordKeys(words: readonly Word[]): Set<string> {
  return new Set(words.map((word) => wordKey(word.simplified, word.pinyinNum)));
}
