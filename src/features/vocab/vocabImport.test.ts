import { describe, expect, it } from 'vitest';
import type { Word } from '@/domain/types';
import type { VocabCsvRow } from './csv';
import { planVocabImport } from './vocabImport';

function row(simplified: string, pinyinNum = '', overrides: Partial<VocabCsvRow> = {}): VocabCsvRow {
  return {
    simplified,
    pinyinNum,
    hanViet: '',
    meaningVi: [],
    meaningEn: [],
    pos: [],
    classifiers: [],
    tags: [],
    ...overrides,
  };
}

const saved: Word = {
  id: 'w1',
  simplified: '行',
  pinyinNum: 'xing2',
  pinyinVariants: [],
  hanViet: 'HÀNH',
  meaningVi: ['đi'],
  meaningEn: [],
  pos: [],
  classifiers: [],
  hsk: {},
  cognate: false,
  source: 'manual',
  examples: [],
  imageStatus: 'none',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
};

describe('planVocabImport', () => {
  it('matches on characters plus pinyin so 多音字 stay separate', () => {
    const plan = planVocabImport([row('行', 'hang2'), row('行', 'xing2')], [saved]);
    expect(plan.create.map((item) => item.pinyinNum)).toEqual(['hang2']);
    expect(plan.update.map((item) => item.word.id)).toEqual(['w1']);
  });

  it('matches on characters alone when the CSV has no pinyin', () => {
    const plan = planVocabImport([row('行')], [saved]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toHaveLength(1);
  });

  it('creates everything when nothing is saved yet', () => {
    const plan = planVocabImport([row('猫', 'mao1'), row('狗')], []);
    expect(plan.create).toHaveLength(2);
    expect(plan.update).toEqual([]);
  });
});
