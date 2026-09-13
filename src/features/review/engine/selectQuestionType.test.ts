import { describe, expect, it } from 'vitest';
import type { QuestionType } from '@/domain/types';
import { mulberry32 } from '@/lib/random';
import { selectQuestionType, type QuestionTypeContext } from './selectQuestionType';

const base: QuestionTypeContext = {
  facet: 'read',
  repetition: 0,
  hasImage: false,
  isConcrete: true,
  learnedWordCount: 10,
  hasClassifier: false,
  hasExample: false,
  geminiAvailable: false,
};

function distribution(context: Partial<QuestionTypeContext>, draws = 10_000): Map<QuestionType, number> {
  const rng = mulberry32(2026);
  const counts = new Map<QuestionType, number>();
  for (let i = 0; i < draws; i++) {
    const type = selectQuestionType({ ...base, ...context }, rng);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return new Map([...counts].map(([type, count]) => [type, count / draws]));
}

function expectShares(context: Partial<QuestionTypeContext>, expected: Partial<Record<QuestionType, number>>) {
  const shares = distribution(context);
  expect([...shares.keys()].sort()).toEqual(Object.keys(expected).sort());
  for (const [type, share] of Object.entries(expected)) {
    expect(Math.abs((shares.get(type as QuestionType) ?? 0) - share)).toBeLessThan(0.02);
  }
}

describe('selectQuestionType — read facet', () => {
  it('rep 0: multiple choice in both directions', () => {
    expectShares({ repetition: 0 }, { 'mcq-hanzi-vi': 0.5, 'mcq-vi-hanzi': 0.5 });
  });

  it('rep 1: picture when a concrete word has a real image, otherwise multiple choice', () => {
    expectShares({ repetition: 1, hasImage: true }, { picture: 1 });
    expectShares({ repetition: 1, hasImage: true, isConcrete: false }, { 'mcq-hanzi-vi': 0.5, 'mcq-vi-hanzi': 0.5 });
  });

  it('rep 2: matching needs four learned words', () => {
    expectShares({ repetition: 2 }, { match: 0.5, 'hanzi-pinyin': 0.5 });
    expectShares({ repetition: 2, learnedWordCount: 3 }, { 'hanzi-pinyin': 1 });
  });

  it('rep 3: pinyin typing, then measure words, sentence ordering or multiple choice', () => {
    expectShares({ repetition: 3, hasClassifier: true }, { 'pinyin-typing': 0.6, 'measure-word': 0.4 });
    expectShares({ repetition: 3, hasExample: true }, { 'pinyin-typing': 0.6, 'sentence-order': 0.4 });
    expectShares({ repetition: 3 }, { 'pinyin-typing': 0.6, 'mcq-hanzi-vi': 0.2, 'mcq-vi-hanzi': 0.2 });
  });

  it('rep 4+: IME cloze, sentence ordering and AI sentence writing when available', () => {
    expectShares(
      { repetition: 6, hasExample: true, geminiAvailable: true },
      { 'ime-cloze': 0.4, 'sentence-order': 0.3, 'sentence-writing': 0.3 },
    );
    expectShares({ repetition: 4, hasClassifier: true }, { 'pinyin-typing': 0.7, 'measure-word': 0.3 });
    expectShares({ repetition: 4 }, { 'pinyin-typing': 1 });
  });
});

describe('selectQuestionType — listen facet', () => {
  it('follows the listening progression', () => {
    expectShares({ facet: 'listen', repetition: 0 }, { 'listen-hanzi': 1 });
    expectShares({ facet: 'listen', repetition: 1 }, { 'listen-meaning': 1 });
    expectShares({ facet: 'listen', repetition: 2 }, { 'listen-tone': 1 });
    expectShares({ facet: 'listen', repetition: 3, hasExample: true }, { 'pinyin-dictation': 1 });
    expectShares({ facet: 'listen', repetition: 5, hasExample: true }, { 'sentence-order': 0.5, 'sentence-dictation': 0.5 });
    expectShares({ facet: 'listen', repetition: 5 }, { 'pinyin-dictation': 1 });
  });
});
