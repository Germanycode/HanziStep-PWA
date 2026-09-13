import { describe, expect, it } from 'vitest';
import type { Card, Facet, Word } from '@/domain/types';
import { DAY_MS } from '@/srs/scheduler';
import { buildReviewPlan, matchBonusItems, remainingNewWords, sessionCompleteEligible, wordKey } from './session';

const NOW = 1_800_000_000_000;

function makeWord(id: string, overrides: Partial<Word> = {}): Word {
  return {
    id,
    simplified: id,
    pinyinNum: 'ma1',
    pinyinVariants: [],
    hanViet: '',
    meaningVi: [],
    meaningEn: [],
    pos: [],
    classifiers: [],
    hsk: {},
    cognate: false,
    source: 'hsk-list',
    examples: [],
    imageStatus: 'none',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeCard(subjectId: string, facet: Facet, dueOffsetMs: number, intervalDays: number, overrides: Partial<Card> = {}): Card {
  return {
    id: `${facet}:${subjectId}`,
    subjectType: 'word',
    subjectId,
    facet,
    state: intervalDays >= 1 ? 'review' : 'learning',
    repetition: intervalDays >= 1 ? 3 : 1,
    easeFactor: 2.5,
    intervalDays,
    due: NOW + dueOffsetMs,
    lapses: 0,
    ...overrides,
  };
}

describe('buildReviewPlan', () => {
  const words = new Map(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => [id, makeWord(id)]));

  it('puts 20-minute cards first, then the most overdue', () => {
    const cards = [
      makeCard('a', 'read', -1 * DAY_MS, 10), // overdue ratio 0.1
      makeCard('b', 'read', -5 * DAY_MS, 5), // ratio 1.0
      makeCard('c', 'read', -60_000, 20 / 1440), // learning, due 1 min ago
      makeCard('d', 'read', -600_000, 20 / 1440), // learning, due 10 min ago
      makeCard('e', 'read', DAY_MS, 3), // not due
    ];
    const plan = buildReviewPlan({ cards, words, now: NOW, reviewedToday: 0, maxReviewsPerDay: 100 });
    expect(plan.items.map((item) => item.subjectId)).toEqual(['d', 'c', 'b', 'a']);
    expect(plan.nextDueAt).toBe(NOW + DAY_MS);
    expect(plan.backlog).toBe(0);
  });

  it('buries sibling facets of the same word', () => {
    const cards = [makeCard('a', 'read', -DAY_MS, 1), makeCard('a', 'listen', -2 * DAY_MS, 1), makeCard('b', 'listen', -DAY_MS, 1)];
    const plan = buildReviewPlan({ cards, words, now: NOW, reviewedToday: 0, maxReviewsPerDay: 100 });
    expect(plan.items.map((item) => item.cardId)).toEqual(['listen:a', 'listen:b']);
    expect(plan.dueCount).toBe(2);
  });

  it('applies the daily cap after reviews already done and reports the backlog', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id, index) => makeCard(id, 'read', -(index + 1) * DAY_MS, 1));
    const plan = buildReviewPlan({ cards, words, now: NOW, reviewedToday: 118, maxReviewsPerDay: 120 });
    expect(plan.items).toHaveLength(2);
    expect(plan).toMatchObject({ dueCount: 4, backlog: 2 });
    expect(buildReviewPlan({ cards, words, now: NOW, reviewedToday: 500, maxReviewsPerDay: 120 }).items).toEqual([]);
  });

  it('skips suspended cards, known or deleted words, and filters by tag', () => {
    const tagged = new Map(words);
    tagged.set('b', makeWord('b', { tags: ['HSK1'] }));
    tagged.set('c', makeWord('c', { knownWithoutSrs: true }));
    const cards = [
      makeCard('a', 'read', -DAY_MS, 1),
      makeCard('b', 'read', -DAY_MS, 1),
      makeCard('c', 'read', -DAY_MS, 1),
      makeCard('d', 'listen', -DAY_MS, 1, { state: 'suspended' }),
      makeCard('ghost', 'read', -DAY_MS, 1),
    ];
    expect(buildReviewPlan({ cards, words: tagged, now: NOW, reviewedToday: 0, maxReviewsPerDay: 100 }).items.map((i) => i.subjectId)).toEqual([
      'a',
      'b',
    ]);
    expect(
      buildReviewPlan({ cards, words: tagged, now: NOW, reviewedToday: 0, maxReviewsPerDay: 100, tag: 'HSK1' }).items.map((i) => i.subjectId),
    ).toEqual(['b']);
  });

  it('includes unlocked cards that were never reviewed', () => {
    const cards = [makeCard('a', 'listen', -1000, 0, { state: 'new', repetition: 0 })];
    expect(buildReviewPlan({ cards, words, now: NOW, reviewedToday: 0, maxReviewsPerDay: 100 }).items).toHaveLength(1);
  });
});

describe('session helpers', () => {
  it('counts the remaining new words for today', () => {
    expect(remainingNewWords(5, 0)).toBe(5);
    expect(remainingNewWords(5, 5)).toBe(0);
    expect(remainingNewWords(5, 7)).toBe(0);
    expect(remainingNewWords(5, 5, 3)).toBe(3);
  });

  it('builds case-insensitive word keys', () => {
    expect(wordKey('北京', 'Bei3 jing1')).toBe('北京|bei3 jing1');
  });

  it('requires a real session for the completion bonus', () => {
    expect(sessionCompleteEligible(1, true)).toBe(false);
    expect(sessionCompleteEligible(5, true)).toBe(true);
    expect(sessionCompleteEligible(9, false)).toBe(false);
    expect(sessionCompleteEligible(10, false)).toBe(true);
  });

  it('finds matching-bonus items later in the queue only', () => {
    const queue = [
      { cardId: 'read:a', subjectId: 'a', facet: 'read' as const },
      { cardId: 'read:b', subjectId: 'b', facet: 'read' as const },
      { cardId: 'listen:c', subjectId: 'c', facet: 'listen' as const },
      { cardId: 'read:d', subjectId: 'd', facet: 'read' as const },
    ];
    expect(matchBonusItems(queue, 1, ['a', 'c', 'd', 'x']).map((item) => item.cardId)).toEqual(['read:d']);
  });
});
