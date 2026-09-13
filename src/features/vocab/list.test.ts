import { describe, expect, it } from 'vitest';
import type { Card, Word } from '@/domain/types';
import { buildVocabRows, countVocab, DEFAULT_VOCAB_FILTERS, filterVocabRows, normalizeSearch, vocabTags } from './list';

function word(id: string, simplified: string, pinyinNum: string, overrides: Partial<Word> = {}): Word {
  return {
    id,
    simplified,
    pinyinNum,
    pinyinVariants: [],
    hanViet: '',
    meaningVi: [],
    meaningEn: [],
    pos: [],
    classifiers: [],
    hsk: { hsk3: 1 },
    cognate: false,
    source: 'hsk-list',
    examples: [],
    imageStatus: 'none',
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function card(subjectId: string, repetition: number, due = 0): Card {
  return {
    id: `read:${subjectId}`,
    subjectType: 'word',
    subjectId,
    facet: 'read',
    state: 'review',
    repetition,
    easeFactor: 2.5,
    intervalDays: repetition,
    due,
    lapses: 0,
  };
}

const WORDS = [
  word('a', '银行', 'yin2 hang2', { hanViet: 'NGÂN HÀNG', meaningVi: ['ngân hàng'], tags: ['tiền'], createdAt: 30, hsk: { hsk3: 2 } }),
  word('b', '你好', 'ni3 hao3', { meaningVi: ['xin chào'], meaningEn: ['hello'], createdAt: 20 }),
  word('c', '猫', 'mao1', { meaningVi: ['con mèo'], createdAt: 10, knownWithoutSrs: true }),
  word('d', '书', 'shu1', { meaningVi: ['sách'], tags: ['tiền', 'đồ vật'], createdAt: 40 }),
];
const CARDS = [card('a', 4, 500), card('b', 1, 100)];
const ROWS = buildVocabRows(WORDS, CARDS, 'hsk3');

describe('vocabulary rows', () => {
  it('joins cards, mastery and HSK level', () => {
    expect(ROWS.map((row) => [row.word.simplified, row.mastery, row.level])).toEqual([
      ['银行', 4, 2],
      ['你好', 1, 1],
      ['猫', -1, 1],
      ['书', -1, 1],
    ]);
  });

  it('counts each mastery group once', () => {
    expect(countVocab(ROWS)).toEqual({ total: 4, pending: 1, learning: 1, review: 0, mastered: 1, known: 1 });
  });

  it('lists tags once, in Vietnamese alphabet order (đ before t)', () => {
    expect(vocabTags(WORDS)).toEqual(['đồ vật', 'tiền']);
  });
});

describe('search and filters', () => {
  const find = (query: string) => filterVocabRows(ROWS, { ...DEFAULT_VOCAB_FILTERS, query }).map((row) => row.word.simplified);

  it('ignores Vietnamese diacritics and pinyin tones', () => {
    expect(normalizeSearch('Ngân hàng đỏ')).toBe('ngan hang do');
    expect(find('ngan hang')).toEqual(['银行']);
    expect(find('nihao')).toEqual(['你好']);
    expect(find('ni3')).toEqual(['你好']);
  });

  it('searches characters, meanings, English and tags', () => {
    expect(find('银')).toEqual(['银行']);
    expect(find('mèo')).toEqual(['猫']);
    expect(find('hello')).toEqual(['你好']);
    expect(find('tiền')).toEqual(['书', '银行']);
  });

  it('filters by tag, level and mastery', () => {
    const by = (patch: Partial<typeof DEFAULT_VOCAB_FILTERS>) =>
      filterVocabRows(ROWS, { ...DEFAULT_VOCAB_FILTERS, ...patch }).map((row) => row.word.simplified);
    expect(by({ tag: 'đồ vật' })).toEqual(['书']);
    expect(by({ level: '2' })).toEqual(['银行']);
    expect(by({ mastery: 'known' })).toEqual(['猫']);
    expect(by({ mastery: 'pending' })).toEqual(['书']);
    expect(by({ mastery: 'mastered' })).toEqual(['银行']);
  });

  it('sorts by the chosen order', () => {
    const by = (sort: typeof DEFAULT_VOCAB_FILTERS.sort) =>
      filterVocabRows(ROWS, { ...DEFAULT_VOCAB_FILTERS, sort }).map((row) => row.word.simplified);
    expect(by('recent')).toEqual(['书', '银行', '你好', '猫']);
    expect(by('alpha')).toEqual(['猫', '你好', '书', '银行']);
    expect(by('due')).toEqual(['你好', '银行', '猫', '书']);
    expect(by('mastery')).toEqual(['书', '猫', '你好', '银行']);
  });
});
