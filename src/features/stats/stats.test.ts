import { describe, expect, it } from 'vitest';
import type { HskWordRecord } from '@/data/types';
import type { Card, DailyStats, Word } from '@/domain/types';
import { emptyDailyStats } from '@/progress/state';
import { buildHeatmap, heatLevel, levelProgress, masteryByFacet, ownedWordKeys, posBreakdown, sumTotals } from './stats';

function day(dayKey: string, patch: Partial<DailyStats>): DailyStats {
  return { ...emptyDailyStats(dayKey), ...patch };
}

function card(id: string, facet: Card['facet'], repetition: number, state: Card['state'] = 'review'): Card {
  return {
    id,
    subjectType: 'word',
    subjectId: id,
    facet,
    state,
    repetition,
    easeFactor: 2.5,
    intervalDays: 1,
    due: 0,
    lapses: 0,
  };
}

describe('heatmap', () => {
  it('shades by daily XP', () => {
    expect([0, 20, 100, 200, 400].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
  });

  it('fills every day in the window, oldest first', () => {
    const cells = buildHeatmap([day('2026-09-10', { xp: 60 }), day('2026-09-12', { xp: 0 })], '2026-09-12', 5);
    expect(cells).toHaveLength(5);
    expect(cells.at(-1)?.dayKey).toBe('2026-09-12');
    expect(cells.map((cell) => cell.level)).toEqual([0, 0, 2, 0, 0]);
  });
});

describe('totals', () => {
  it('sums XP, answers and active days, and derives accuracy', () => {
    expect(
      sumTotals([
        day('2026-09-11', { xp: 100, learningXp: 100, answers: 10, correct: 8, newIntroduced: 5 }),
        day('2026-09-12', { xp: 20, learningXp: 0, answers: 2, correct: 1 }),
      ]),
    ).toEqual({ xp: 120, answers: 12, correct: 9, accuracy: 0.75, newIntroduced: 5, activeDays: 1 });
  });

  it('reports zero accuracy with no answers', () => {
    expect(sumTotals([]).accuracy).toBe(0);
  });
});

describe('mastery and parts of speech', () => {
  it('groups cards per facet and counts suspended ones separately', () => {
    const result = masteryByFacet([
      card('a', 'read', 0),
      card('b', 'read', 4),
      card('c', 'read', 7),
      card('d', 'listen', 1, 'suspended'),
    ]);
    expect(result.map((entry) => entry.facet)).toEqual(['read', 'listen']);
    expect(result[0]).toMatchObject({ counts: [1, 0, 0, 0, 2], suspended: 0, total: 3 });
    expect(result[1]).toMatchObject({ suspended: 1, total: 1 });
  });

  it('counts each word once per part of speech, most common first', () => {
    const words = [
      { pos: ['n'] },
      { pos: ['n', 'v'] },
      { pos: ['v'] },
      { pos: ['v'] },
    ] as Word[];
    expect(posBreakdown(words, 2)).toEqual([
      { code: 'v', label: 'động từ', count: 3 },
      { code: 'n', label: 'danh từ', count: 2 },
    ]);
  });
});

describe('HSK progress', () => {
  const records = [
    { s: '猫', q: 1, pos: [], lv: {}, f: [{ t: '貓', py: 'māo', pn: 'mao1', en: [], vi: [], cl: [], hv: '' }] },
    { s: '狗', q: 2, pos: [], lv: {}, f: [{ t: '狗', py: 'gǒu', pn: 'gou3', en: [], vi: [], cl: [], hv: '' }] },
  ] as HskWordRecord[];

  it('matches saved words by characters and pinyin', () => {
    const owned = ownedWordKeys([{ simplified: '猫', pinyinNum: 'MAO1' } as Word]);
    expect(levelProgress(1, records, owned)).toEqual({ level: 1, total: 2, owned: 1, pct: 50 });
  });

  it('handles an empty level file', () => {
    expect(levelProgress(3, [], new Set())).toEqual({ level: 3, total: 0, owned: 0, pct: 0 });
  });
});
