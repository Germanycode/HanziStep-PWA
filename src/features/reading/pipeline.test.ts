import { describe, expect, it } from 'vitest';
import { createLexicon } from '@/chinese/segment/types';
import type { Card, DictEntry, Word } from '@/domain/types';
import { assemble, buildStatusLookup, distinctWords, savedReadings, segmentDoc, sentencesFromText } from './pipeline';

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
    hsk: {},
    cognate: false,
    source: 'manual',
    examples: [],
    imageStatus: 'none',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function readCard(subjectId: string, repetition: number): Card {
  return {
    id: `read:${subjectId}`,
    subjectType: 'word',
    subjectId,
    facet: 'read',
    state: 'review',
    repetition,
    easeFactor: 2.5,
    intervalDays: 1,
    due: 0,
    lapses: 0,
  };
}

describe('pipeline helpers', () => {
  it('splits pasted text into sentences', () => {
    expect(sentencesFromText('你好。\r\n再见！')).toEqual([{ zh: '你好。' }, { zh: '再见！' }]);
    expect(sentencesFromText('   ')).toEqual([]);
  });

  it('collects the distinct words of a text', () => {
    const lexicon = createLexicon(['你好', '再见']);
    const rows = segmentDoc([{ zh: '你好。' }, { zh: '你好，再见。' }], {}, lexicon);
    expect(distinctWords(rows).sort()).toEqual(['你好', '再见']);
  });

  it('keeps the most advanced entry when the same characters are saved twice', () => {
    const words = [word('a', '行', 'xing2'), word('b', '行', 'hang2'), word('c', '猫', 'mao1', { knownWithoutSrs: true })];
    const lookup = buildStatusLookup(words, [readCard('a', 1), readCard('b', 5)], [], () => true);
    expect(lookup.saved.get('行')).toEqual({ repetition: 5, known: false });
    expect(lookup.saved.get('猫')?.known).toBe(true);
  });

  it('prefers the reading the learner already saved', () => {
    expect(savedReadings([word('a', '行', 'xing2'), word('b', '行', 'hang2')]).get('行')).toBe('xing2');
  });
});

describe('performance', () => {
  // Words a beginner text is built from; every one gets a two-syllable reading.
  const POOL = [
    '我们', '你们', '他们', '朋友', '老师', '学生', '中国', '北京', '上海', '公司',
    '工作', '学习', '喜欢', '知道', '觉得', '时间', '今天', '明天', '昨天', '现在',
    '吃饭', '喝水', '看书', '说话', '走路', '起床', '睡觉', '回家', '出门', '买东西',
  ];
  const entries = new Map<string, DictEntry[]>(
    POOL.map((item) => [item, [{ s: item, t: item, p: 'ni3 hao3', pt: 'nihao', en: [], vi: ['nghĩa'], cl: [] }]]),
  );
  const lexicon = createLexicon(POOL);
  const sentences = Array.from({ length: 10 }, (_, index) => ({
    zh: `${Array.from({ length: 25 }, (_, position) => POOL[(index * 25 + position) % POOL.length]).join('')}。`,
  }));

  it('segments and reads a 500-character text well inside the 300 ms budget', () => {
    const characters = sentences.reduce((total, sentence) => total + sentence.zh.length, 0);
    expect(characters).toBeGreaterThan(500);

    const status = buildStatusLookup([], [], [], (item) => entries.has(item));
    const started = performance.now();
    // The dictionary is already in memory here, which is what the budget assumes.
    const rows = segmentDoc(sentences, {}, lexicon);
    const prepared = assemble(sentences, rows, { dict: entries }, status);
    const elapsed = performance.now() - started;

    expect(prepared.flatMap((sentence) => sentence.tokens).length).toBeGreaterThan(200);
    expect(elapsed).toBeLessThan(300);
  });
});
