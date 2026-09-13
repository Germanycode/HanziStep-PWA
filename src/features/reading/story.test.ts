import { describe, expect, it } from 'vitest';
import { createLexicon } from '@/chinese/segment/types';
import { coverageThreshold, MAX_ALLOWED_WORDS, retryPrompt, storyPrompt, storyRules } from '@/services/ai/prompts/story';
import { FUNCTION_WORDS, parseStory, storyCoverage, toQuestions } from './story';

const LEXICON = createLexicon(['我', '喜欢', '猫', '狗', '量子', '力学', '他', '的', '很', '大']);

describe('story rules', () => {
  it('follows the level table and the beginner mode', () => {
    expect(storyRules(1)).toMatchObject({ minSentences: 4, maxSentences: 8, maxSentenceChars: 12, answersInChinese: false });
    expect(storyRules(3)).toMatchObject({ maxChars: 350, maxTargets: 6, answersInChinese: true });
    expect(storyRules(9)).toEqual(storyRules(4));
    expect(storyRules(3, true)).toMatchObject({ maxSentences: 4, maxSentenceChars: 8 });
  });

  it('requires more coverage at the lowest levels', () => {
    expect(coverageThreshold(1)).toBe(0.95);
    expect(coverageThreshold(2)).toBe(0.95);
    expect(coverageThreshold(3)).toBe(0.92);
  });
});

describe('storyPrompt', () => {
  const prompt = storyPrompt({
    level: 1,
    rules: storyRules(1),
    genre: 'đời thường',
    targets: [{ hanzi: '猫', vi: 'con mèo' }],
    allowed: Array.from({ length: 500 }, (_, index) => `词${index}`),
    micro: false,
  });

  it('states the limits, the targets and the closed word list', () => {
    expect(prompt).toContain('4–8 câu');
    expect(prompt).toContain('tối đa 12 chữ Hán');
    expect(prompt).toContain('猫 (con mèo)');
    expect(prompt).toContain('CHỈ dùng từ trong DANH SÁCH CHO PHÉP');
    expect(prompt).toContain('KHÔNG viết pinyin');
    expect(prompt).toContain(`DANH SÁCH CHO PHÉP (${MAX_ALLOWED_WORDS} từ)`);
    expect(prompt).not.toContain('词400');
  });

  it('asks for Vietnamese answers at HSK 1 and Chinese answers above', () => {
    expect(prompt).toContain('đáp án bằng tiếng Việt');
    expect(storyPrompt({ level: 3, rules: storyRules(3), genre: 'ở trường', targets: [], allowed: [], micro: false })).toContain(
      'đáp án bằng tiếng Trung',
    );
  });

  it('names the words to replace on a retry', () => {
    expect(retryPrompt('BASE', ['量子', '力学'])).toContain('量子、力学');
  });
});

describe('storyCoverage', () => {
  const allowed = new Set(['我', '喜欢', '猫', ...FUNCTION_WORDS]);

  it('is 1 when every word is allowed', () => {
    expect(storyCoverage(['我喜欢猫。'], LEXICON, allowed)).toMatchObject({ coverage: 1, outside: [], contentTokens: 3 });
  });

  it('counts every occurrence of a word outside the list', () => {
    const result = storyCoverage(['我喜欢量子力学。'], LEXICON, allowed);
    expect(result.contentTokens).toBe(4);
    expect(result.outside.sort()).toEqual(['力学', '量子']);
    expect(result.coverage).toBeCloseTo(0.5);
  });

  it('ignores punctuation and empty stories', () => {
    expect(storyCoverage(['。，！'], LEXICON, allowed).coverage).toBe(1);
    expect(storyCoverage([], LEXICON, allowed).coverage).toBe(1);
  });
});

describe('parseStory', () => {
  const valid = {
    titleZh: '我的猫',
    titleVi: 'Con mèo của tôi',
    sentences: [{ zh: '我有一只猫。', vi: 'Tôi có một con mèo.' }],
    questions: [{ type: 'mcq', qZh: '谁有猫？', qVi: 'Ai có mèo?', options: ['我', '他', '她', '你'], answerZh: '我', answerVi: 'Tôi' }],
  };

  it('accepts a well-formed story and maps the questions', () => {
    const story = parseStory(valid);
    expect(story.sentences[0]?.zh).toBe('我有一只猫。');
    expect(toQuestions(story)[0]).toMatchObject({ type: 'mcq', answerVi: 'Tôi' });
  });

  it('defaults the missing pieces the model may skip', () => {
    const story = parseStory({ ...valid, questions: undefined, sentences: [{ zh: '我有一只猫。' }] });
    expect(story.questions).toEqual([]);
    expect(story.sentences[0]?.vi).toBe('');
  });

  it('rejects a story with no sentences', () => {
    expect(() => parseStory({ ...valid, sentences: [] })).toThrow();
  });

  it('rejects malformed multiple-choice questions', () => {
    expect(() => parseStory({ ...valid, questions: [{ ...valid.questions[0], options: ['我', '我', '他', '你'] }] })).toThrow();
    expect(() => parseStory({ ...valid, questions: [{ ...valid.questions[0], options: ['他', '她', '你', '猫'] }] })).toThrow();
  });
});
