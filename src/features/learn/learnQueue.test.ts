import { describe, expect, it } from 'vitest';
import type { HskWordRecord } from '@/data/types';
import type { Word } from '@/domain/types';
import { wordKey } from '@/features/review/engine/session';
import { pickLearnCandidates } from './learnQueue';

const record = (s: string, pn: string, vi: string[] = ['nghĩa']): HskWordRecord => ({
  s,
  q: 1,
  pos: ['n'],
  lv: { hsk3: 1 },
  f: [{ t: s, py: pn, pn, en: vi.length ? ['meaning'] : [], vi, cl: [], hv: '' }],
});

const saved = { id: 'saved-1', simplified: '猫', pinyinNum: 'mao1' } as Word;

describe('pickLearnCandidates', () => {
  it('puts saved words first, skips existing and empty entries, and respects the limit', () => {
    const records = [record('你', 'ni3'), record('好', 'hao3'), record('空', 'kong1', []), record('我', 'wo3'), record('他', 'ta1')];
    const existing = new Set([wordKey('好', 'hao3')]);
    const picked = pickLearnCandidates([saved], records, existing, 3);
    expect(picked.map((item) => (item.kind === 'saved' ? item.word.simplified : item.record.s))).toEqual(['猫', '你', '我']);
  });

  it('never returns the same word twice', () => {
    const picked = pickLearnCandidates([], [record('你', 'ni3'), record('你', 'ni3')], new Set(), 5);
    expect(picked).toHaveLength(1);
  });

  it('returns nothing when the limit is zero', () => {
    expect(pickLearnCandidates([saved], [record('你', 'ni3')], new Set(), 0)).toEqual([]);
  });
});
