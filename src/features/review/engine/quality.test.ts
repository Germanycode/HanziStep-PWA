import { describe, expect, it } from 'vitest';
import { qualityFor, type AnswerSignal } from './quality';

const q = (signal: Partial<AnswerSignal> & Pick<AnswerSignal, 'questionType'>) =>
  qualityFor({ correct: true, elapsedMs: 1000, ...signal });

describe('qualityFor (docs/PLAN.md §5.3)', () => {
  it('grades choice questions by time and caps revealed pinyin', () => {
    expect(q({ questionType: 'mcq-hanzi-vi', correct: false })).toBe(0);
    expect(q({ questionType: 'mcq-hanzi-vi', elapsedMs: 2999 })).toBe(5);
    expect(q({ questionType: 'mcq-vi-hanzi', elapsedMs: 3000 })).toBe(4);
    expect(q({ questionType: 'picture', elapsedMs: 8000 })).toBe(3);
    expect(q({ questionType: 'hanzi-pinyin', elapsedMs: 1000, pinyinRevealed: true })).toBe(4);
  });

  it('grades listening by time and replays', () => {
    expect(q({ questionType: 'listen-hanzi', elapsedMs: 3000, replays: 1 })).toBe(5);
    expect(q({ questionType: 'listen-hanzi', elapsedMs: 3000, replays: 2 })).toBe(4);
    expect(q({ questionType: 'listen-meaning', elapsedMs: 9000 })).toBe(4);
    expect(q({ questionType: 'listen-tone', elapsedMs: 12_000 })).toBe(3);
    expect(q({ questionType: 'listen-tone', elapsedMs: 5000, replays: 3 })).toBe(3);
    expect(q({ questionType: 'listen-tone', correct: false })).toBe(0);
  });

  it('grades matching like the extension', () => {
    expect(q({ questionType: 'match' })).toBe(4);
    expect(q({ questionType: 'match', correct: false })).toBe(0);
  });

  it('grades pinyin typing with tone-only errors, hints and easy mode', () => {
    expect(q({ questionType: 'pinyin-typing', correct: false })).toBe(0);
    expect(q({ questionType: 'pinyin-typing', correct: false, toneOnlyError: true })).toBe(2);
    expect(q({ questionType: 'pinyin-typing', elapsedMs: 5000 })).toBe(5);
    expect(q({ questionType: 'pinyin-dictation', elapsedMs: 14_000 })).toBe(4);
    expect(q({ questionType: 'pinyin-typing', elapsedMs: 1000, hints: 1 })).toBe(3);
    expect(q({ questionType: 'pinyin-typing', elapsedMs: 1000, easyMode: true })).toBe(3);
  });

  it('grades cloze, measure words and sentence ordering', () => {
    expect(q({ questionType: 'ime-cloze', elapsedMs: 7000 })).toBe(5);
    expect(q({ questionType: 'ime-cloze', elapsedMs: 19_000 })).toBe(4);
    expect(q({ questionType: 'ime-cloze', elapsedMs: 1000, hints: 1 })).toBe(3);
    expect(q({ questionType: 'measure-word', elapsedMs: 3000 })).toBe(5);
    expect(q({ questionType: 'measure-word', elapsedMs: 11_000 })).toBe(3);
    expect(q({ questionType: 'sentence-order', elapsedMs: 9000, attempts: 1 })).toBe(5);
    expect(q({ questionType: 'sentence-order', elapsedMs: 20_000, attempts: 1 })).toBe(4);
    expect(q({ questionType: 'sentence-order', attempts: 2 })).toBe(3);
    expect(q({ questionType: 'sentence-order', attempts: 3 })).toBe(0);
  });

  it('grades dictation by character accuracy', () => {
    expect(q({ questionType: 'sentence-dictation', accuracy: 1, replays: 2 })).toBe(5);
    expect(q({ questionType: 'sentence-dictation', accuracy: 1, replays: 3 })).toBe(4);
    expect(q({ questionType: 'sentence-dictation', accuracy: 0.92 })).toBe(3);
    expect(q({ questionType: 'sentence-dictation', accuracy: 0.5, correct: false })).toBe(1);
  });

  it('never gives speaking a 5 and grades AI sentence writing by score', () => {
    expect(q({ questionType: 'speak' })).toBe(4);
    expect(q({ questionType: 'speak', attempts: 2 })).toBe(3);
    expect(q({ questionType: 'speak', correct: false })).toBe(1);
    expect(q({ questionType: 'sentence-writing', score: 0.95 })).toBe(4);
    expect(q({ questionType: 'sentence-writing', score: 0.7 })).toBe(3);
    expect(q({ questionType: 'sentence-writing', score: 0.4, correct: false })).toBe(0);
  });
});
