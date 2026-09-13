import { describe, expect, it } from 'vitest';
import type { HskWordRecord } from '@/data/types';
import { wordKey } from '@/features/review/engine/session';
import { planPlacement } from './placement';

function record(simplified: string, pinyinNum: string): HskWordRecord {
  return {
    s: simplified,
    q: 1,
    pos: ['n'],
    lv: { hsk3: 1 },
    f: [{ t: simplified, py: pinyinNum, pn: pinyinNum, en: ['x'], vi: ['nghĩa'], cl: [], hv: '' }],
  };
}

describe('planPlacement', () => {
  const records = [record('猫', 'mao1'), record('狗', 'gou3'), record('书', 'shu1')];

  it('takes every word when nothing is saved yet', () => {
    const plan = planPlacement(records, new Set());
    expect(plan).toMatchObject({ skipped: 0, total: 3 });
    expect(plan.toAdd.map((item) => item.s)).toEqual(['猫', '狗', '书']);
  });

  it('leaves words the learner already has alone', () => {
    const plan = planPlacement(records, new Set([wordKey('猫', 'mao1')]));
    expect(plan.skipped).toBe(1);
    expect(plan.toAdd.map((item) => item.s)).toEqual(['狗', '书']);
  });

  it('matches on characters plus pinyin, so 多音字 are separate entries', () => {
    const plan = planPlacement([record('行', 'xing2'), record('行', 'hang2')], new Set([wordKey('行', 'hang2')]));
    expect(plan.toAdd.map((item) => item.f[0]?.pn)).toEqual(['xing2']);
  });

  it('never adds the same word twice within one level', () => {
    const plan = planPlacement([record('猫', 'mao1'), record('猫', 'mao1')], new Set());
    expect(plan.toAdd).toHaveLength(1);
    expect(plan.skipped).toBe(1);
  });

  it('skips records with no form', () => {
    const broken = { ...record('空', 'kong1'), f: [] } as HskWordRecord;
    expect(planPlacement([broken], new Set()).toAdd).toEqual([]);
  });
});
