import { describe, expect, it } from 'vitest';
import { coachSystemPrompt, COACH_SCENARIOS, MAX_COACH_WORDS } from '@/services/ai/prompts/coach';

const scenario = COACH_SCENARIOS[0]!;

describe('coachSystemPrompt', () => {
  it('pins the languages and the short-phrase rule', () => {
    const prompt = coachSystemPrompt({ level: 1, learnedWords: ['你好'], targets: ['买'], scenario });
    expect(prompt).toContain('小林老师');
    expect(prompt).toContain('HSK1');
    expect(prompt).toContain('instructions and explanations in Vietnamese');
    expect(prompt).toContain('at most 8 characters');
    expect(prompt).toContain('Use only these words: 你好.');
    expect(prompt).toContain("Today's focus words: 买.");
  });

  it('never claims the tone judgement is reliable', () => {
    const prompt = coachSystemPrompt({ level: 2, learnedWords: [], targets: [], scenario });
    expect(prompt).toContain('tone judgement may be imperfect');
    expect(prompt).toContain('simplest HSK 1 words');
  });

  it('caps the word list so the prompt stays small', () => {
    const many = Array.from({ length: MAX_COACH_WORDS + 50 }, (_, index) => `词${index}`);
    const prompt = coachSystemPrompt({ level: 3, learnedWords: many, targets: [], scenario });
    expect(prompt).toContain(`词${MAX_COACH_WORDS - 1}`);
    expect(prompt).not.toContain(`词${MAX_COACH_WORDS}`);
  });

  it('offers a Vietnamese question-and-answer scenario', () => {
    const ask = COACH_SCENARIOS.find((item) => item.id === 'ask');
    expect(ask?.focus).toContain('Vietnamese');
  });
});
