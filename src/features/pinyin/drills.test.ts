import { describe, expect, it } from 'vitest';
import { SYLLABLES, syllableAudioKey } from '@/chinese/pinyin/syllables';
import type { SyllableTable } from '@/data/syllables';
import type { SyllableInfo } from '@/data/types';
import { mulberry32 } from '@/lib/random';
import type { DrillStats } from '@/progress/state';
import { applyDrillAnswer, buildRound, itemWeight, pickWeighted, roundXp, updateItemStat } from './drillEngine';
import { CONTRASTS, drillItemKeys, makeQuestion } from './drills';

const fullTable: SyllableTable = new Map(
  SYLLABLES.map((base): [string, SyllableInfo] => {
    const key = syllableAudioKey(base);
    return [key, { key, display: base, initial: '', final: base, tones: [1, 2, 3, 4, 5] }];
  }),
);

const emptyStats: DrillStats = { items: {}, toneCorrectTotal: 0, toneRecent: [] };

describe('drill engine', () => {
  it('moves the error rate towards recent answers', () => {
    const wrong = updateItemStat(undefined, false, 1);
    expect(wrong).toEqual({ ema: 0.65, attempts: 1, lastAt: 1 });
    const right = updateItemStat(wrong, true, 2);
    expect(right.ema).toBeCloseTo(0.455);
    expect(itemWeight(undefined)).toBeCloseTo(0.65);
    expect(itemWeight({ ema: 0, attempts: 9, lastAt: 0 })).toBeCloseTo(0.15);
  });

  it('picks items in proportion to their weights', () => {
    const rng = mulberry32(99);
    let heavy = 0;
    for (let i = 0; i < 10_000; i++) if (pickWeighted(['light', 'heavy'], (item) => (item === 'heavy' ? 3 : 1), rng) === 'heavy') heavy++;
    expect(heavy / 10_000).toBeGreaterThan(0.72);
    expect(heavy / 10_000).toBeLessThan(0.78);
    expect(pickWeighted([], () => 1, rng)).toBeUndefined();
  });

  it('favours weak items and never repeats a key back to back', () => {
    const stats: DrillStats = {
      ...emptyStats,
      items: { 'tone:3': { ema: 0.9, attempts: 10, lastAt: 0 }, 'tone:1': { ema: 0, attempts: 10, lastAt: 0 } },
    };
    const round = buildRound(['tone:1', 'tone:2', 'tone:3', 'tone:4'], stats, 400, mulberry32(3));
    expect(round).toHaveLength(400);
    expect(round.every((key, index) => index === 0 || key !== round[index - 1])).toBe(true);
    const count = (key: string) => round.filter((item) => item === key).length;
    expect(count('tone:3')).toBeGreaterThan(count('tone:1'));
  });

  it('tracks tone accuracy over the last 100 answers', () => {
    let stats = emptyStats;
    for (let i = 0; i < 120; i++) stats = applyDrillAnswer(stats, 'tone:1', i % 4 !== 0, true, i);
    expect(stats.toneRecent).toHaveLength(100);
    expect(stats.toneCorrectTotal).toBe(90);
    const minimal = applyDrillAnswer(stats, 'minimal:n-l', false, false, 200);
    expect(minimal.toneRecent).toBe(stats.toneRecent);
    expect(minimal.items['minimal:n-l']?.attempts).toBe(1);
  });

  it('adds the bonus for rounds with at least 90% correct', () => {
    expect(roundXp(9, 10)).toBe(25);
    expect(roundXp(8, 10)).toBe(15);
    expect(roundXp(0, 0)).toBe(15);
  });
});

describe('drill questions', () => {
  it('lists item keys per drill', () => {
    expect(drillItemKeys('tone-id', fullTable)).toEqual(['tone:1', 'tone:2', 'tone:3', 'tone:4']);
    expect(drillItemKeys('pinyin-typing', fullTable)).toEqual(['type:1', 'type:2', 'type:3', 'type:4']);
    expect(drillItemKeys('tone-pairs', fullTable)).toHaveLength(20);
    expect(drillItemKeys('minimal-pairs', fullTable)).toHaveLength(CONTRASTS.length);
  });

  it('builds contrasts from real syllables', () => {
    const pairs = (id: string) => CONTRASTS.find((contrast) => contrast.id === id)?.pairs ?? [];
    expect(pairs('zh-z')).toContainEqual(['zhang', 'zang']);
    expect(pairs('zh-z').some(([a]) => a === 'zi')).toBe(false);
    expect(pairs('n-l')).toContainEqual(['nan', 'lan']);
    expect(pairs('in-ing')).toContainEqual(['xin', 'xing']);
    expect(pairs('an-ang').some(([a]) => a.endsWith('ian'))).toBe(false);
  });

  it('makes tone-id questions whose answer matches the played tone', () => {
    const rng = mulberry32(5);
    for (const tone of [1, 2, 3, 4]) {
      const question = makeQuestion('tone-id', `tone:${tone}`, fullTable, rng);
      expect(question.prompt[0]?.tone).toBe(tone);
      expect(question.answerId).toBe(String(tone));
      expect(question.options).toHaveLength(4);
    }
  });

  it('makes tone-pair questions with four unique confusable options', () => {
    const rng = mulberry32(8);
    const question = makeQuestion('tone-pairs', 'pair:3-5', fullTable, rng);
    expect(question.prompt.map((syllable) => syllable.tone)).toEqual([3, 5]);
    const ids = question.options.map((option) => option.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toContain('3-5');
    expect(ids.every((id) => id === '3-5' || id.startsWith('3-') || id.endsWith('-5'))).toBe(true);
  });

  it('makes minimal-pair and typing questions', () => {
    const rng = mulberry32(13);
    const minimal = makeQuestion('minimal-pairs', 'minimal:u-ü', fullTable, rng);
    expect(minimal.options.map((option) => option.id).sort()).toEqual(minimal.prompt[0]?.base === 'nu' || minimal.prompt[0]?.base === 'nü' ? ['nu', 'nü'] : ['lu', 'lü']);
    expect(minimal.answerId).toBe(minimal.prompt[0]?.base);
    const typing = makeQuestion('pinyin-typing', 'type:2', fullTable, rng);
    expect(typing.expected).toEqual(typing.prompt);
    expect(typing.prompt[0]?.tone).toBe(2);
  });
});
