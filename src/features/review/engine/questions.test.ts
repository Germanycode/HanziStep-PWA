import { describe, expect, it } from 'vitest';
import type { SentenceRecord } from '@/data/types';
import type { Facet, QuestionType, Word } from '@/domain/types';
import { mulberry32 } from '@/lib/random';
import { glossesOverlap, type DistractorCandidate } from './distractors';
import { buildQuestion, fallbackChain, findCloze, type ChoiceQuestion, type QuestionResources } from './questions';
import { gradeOrder } from './grading';

function word(simplified: string, pinyinNum: string, meaningVi: string[], pos: string[], classifiers: string[] = []): Word {
  return {
    id: `w-${simplified}`,
    simplified,
    pinyinNum,
    pinyinVariants: [],
    hanViet: '',
    meaningVi,
    meaningEn: [],
    pos,
    classifiers,
    hsk: { hsk3: 1 },
    cognate: false,
    source: 'hsk-list',
    examples: [],
    imageStatus: 'none',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const WORDS = [
  word('猫', 'mao1', ['con mèo'], ['n'], ['只']),
  word('狗', 'gou3', ['con chó'], ['n'], ['只', '条']),
  word('书', 'shu1', ['sách', 'quyển sách'], ['n'], ['本']),
  word('吃', 'chi1', ['ăn'], ['v']),
  word('喝', 'he1', ['uống'], ['v']),
  word('高兴', 'gao1 xing4', ['vui mừng', 'vui vẻ'], ['a']),
  word('快乐', 'kuai4 le4', ['vui vẻ', 'hạnh phúc'], ['a']),
  word('你好', 'ni3 hao3', ['xin chào'], ['i']),
  word('老师', 'lao3 shi1', ['giáo viên', 'thầy giáo'], ['n'], ['位', '个']),
  word('学生', 'xue2 sheng5', ['học sinh'], ['n'], ['个']),
  word('水', 'shui3', ['nước'], ['n'], ['杯']),
  word('买', 'mai3', ['mua'], ['v']),
  word('卖', 'mai4', ['bán'], ['v']),
  word('大', 'da4', ['to', 'lớn'], ['a']),
  word('天', 'tian1', ['trời', 'ngày'], ['n']),
  word('妈妈', 'ma1 ma5', ['mẹ'], ['n']),
];

const byName = (simplified: string): Word => {
  const found = WORDS.find((item) => item.simplified === simplified);
  if (!found) throw new Error(simplified);
  return found;
};

const POOL: DistractorCandidate[] = WORDS.map((item) => ({
  id: item.id,
  simplified: item.simplified,
  pinyinNum: item.pinyinNum,
  meaningVi: item.meaningVi,
  pos: item.pos,
  hskLevel: 1,
}));

const EXAMPLES: SentenceRecord[] = [
  { zh: '我喜欢猫。', en: 'I like cats.', ids: [1] },
  { zh: '他的猫很大。', en: 'His cat is big.', ids: [2] },
];

function resources(overrides: Partial<QuestionResources> = {}): QuestionResources {
  return {
    pool: POOL,
    matchWords: WORDS,
    examples: [],
    hasImage: false,
    geminiAvailable: false,
    sentenceAudio: true,
    hskLevel: 1,
    ...overrides,
  };
}

function assertChoice(question: ChoiceQuestion) {
  const ids = question.options.map((option) => option.id);
  const values = question.options.map((option) => option.value);
  expect(ids.filter((id) => id === question.answerId)).toHaveLength(1);
  expect(new Set(values).size).toBe(values.length);
  if (question.optionKind === 'meaning') {
    const answer = POOL.find((item) => item.id === question.answerId);
    for (const option of question.options) {
      if (option.id === question.answerId) continue;
      const other = POOL.find((item) => item.id === option.id);
      expect(glossesOverlap(answer?.meaningVi ?? [], other?.meaningVi ?? [])).toBe(false);
    }
  }
}

describe('buildQuestion by type', () => {
  const rng = () => mulberry32(7);

  it('builds meaning, character and pinyin choices with exactly one right answer', () => {
    for (const type of ['mcq-hanzi-vi', 'mcq-vi-hanzi', 'hanzi-pinyin', 'listen-hanzi', 'listen-meaning', 'listen-tone'] as QuestionType[]) {
      const facet: Facet = type.startsWith('listen') ? 'listen' : 'read';
      const question = buildQuestion({ word: byName('高兴'), facet, repetition: 2, forceType: type }, resources(), rng());
      expect(question.type).toBe(type);
      expect(question.kind).toBe('choice');
      assertChoice(question as ChoiceQuestion);
    }
  });

  it('never offers a synonym as a wrong meaning (高兴 vs 快乐)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const question = buildQuestion(
        { word: byName('高兴'), facet: 'read', repetition: 1, forceType: 'mcq-hanzi-vi' },
        resources(),
        mulberry32(seed),
      ) as ChoiceQuestion;
      expect(question.options.some((option) => option.value === 'vui vẻ')).toBe(false);
    }
  });

  it('does not offer the spoken sandhi reading as a wrong tone pattern', () => {
    for (let seed = 0; seed < 100; seed++) {
      const question = buildQuestion(
        { word: byName('你好'), facet: 'listen', repetition: 2, forceType: 'listen-tone' },
        resources(),
        mulberry32(seed),
      ) as ChoiceQuestion;
      expect(question.answerId).toBe('ni3 hao3');
      expect(question.options.map((option) => option.value)).not.toContain('ni2 hao3');
    }
  });

  it('builds measure-word questions from the stored classifiers', () => {
    const question = buildQuestion({ word: byName('书'), facet: 'read', repetition: 3, forceType: 'measure-word' }, resources(), rng());
    expect(question.type).toBe('measure-word');
    const choice = question as ChoiceQuestion;
    expect(choice.answerId).toBe('本');
    assertChoice(choice);
  });

  it('builds pinyin typing with sandhi readings accepted and a cloze when an example exists', () => {
    const question = buildQuestion(
      { word: byName('猫'), facet: 'read', repetition: 3, forceType: 'pinyin-typing' },
      resources({ examples: EXAMPLES }),
      rng(),
    );
    expect(question.kind).toBe('pinyin');
    if (question.kind !== 'pinyin') return;
    expect(question.accepted).toEqual(['mao1']);
    expect(question.cloze?.before).toBe('我喜欢');
    const hello = buildQuestion({ word: byName('你好'), facet: 'read', repetition: 3, forceType: 'pinyin-typing' }, resources(), rng());
    expect(hello.kind === 'pinyin' && hello.accepted).toEqual(['ni3 hao3', 'ni2 hao3']);
  });

  it('builds sentence ordering with shuffled tiles that spell the sentence', () => {
    const question = buildQuestion(
      { word: byName('猫'), facet: 'read', repetition: 4, forceType: 'sentence-order' },
      resources({ examples: EXAMPLES }),
      rng(),
    );
    expect(question.kind).toBe('order');
    if (question.kind !== 'order') return;
    const original = [...question.tiles].sort((a, b) => Number(a.id) - Number(b.id)).map((tile) => tile.text);
    expect(gradeOrder(original, question.sentence.zh)).toBe(true);
    expect(question.tiles.map((tile) => tile.text).join('')).not.toBe(original.join(''));
  });

  it('builds a 4-pair match with distinct, non-synonymous meanings', () => {
    const question = buildQuestion({ word: byName('高兴'), facet: 'read', repetition: 2, forceType: 'match' }, resources(), rng());
    expect(question.kind).toBe('match');
    if (question.kind !== 'match') return;
    expect(question.pairs).toHaveLength(4);
    expect(question.pairs.map((pair) => pair.wordId)).toContain(byName('高兴').id);
    expect(question.pairs.map((pair) => pair.hanzi)).not.toContain('快乐');
    expect(new Set(question.meaningOrder)).toEqual(new Set(question.pairs.map((pair) => pair.wordId)));
  });
});

describe('fallbacks', () => {
  const rng = () => mulberry32(3);

  it('uses multiple choice without pinyin when there is no image', () => {
    const question = buildQuestion({ word: byName('猫'), facet: 'read', repetition: 1, forceType: 'picture' }, resources(), rng());
    expect(question.type).toBe('mcq-vi-hanzi');
    expect((question as ChoiceQuestion).showPinyin).toBe(false);
  });

  it('falls back when resources are missing', () => {
    const cases: [QuestionType, Facet, Partial<QuestionResources>, QuestionType][] = [
      ['match', 'read', { matchWords: WORDS.slice(0, 2) }, 'hanzi-pinyin'],
      ['ime-cloze', 'read', { examples: [] }, 'pinyin-typing'],
      ['sentence-writing', 'read', { geminiAvailable: false }, 'pinyin-typing'],
      ['measure-word', 'read', { examples: [] }, 'pinyin-typing'],
      ['sentence-order', 'listen', { examples: EXAMPLES, sentenceAudio: false }, 'pinyin-dictation'],
      ['sentence-dictation', 'listen', { examples: [] }, 'pinyin-dictation'],
    ];
    for (const [type, facet, overrides, expected] of cases) {
      const target = type === 'measure-word' ? byName('吃') : byName('猫');
      const question = buildQuestion({ word: target, facet, repetition: 4, forceType: type }, resources(overrides), rng());
      expect(question.type, type).toBe(expected);
    }
  });

  it('keeps listening fallbacks on the listening facet', () => {
    expect(fallbackChain('sentence-order', 'listen')).not.toContain('measure-word');
    expect(fallbackChain('sentence-order', 'listen').at(-1)).toBe('listen-meaning');
    expect(fallbackChain('picture', 'read')).toEqual(['picture', 'mcq-vi-hanzi', 'hanzi-pinyin', 'mcq-hanzi-vi']);
  });

  it('skips example sentences that contain the word twice for cloze', () => {
    const twice: SentenceRecord = { zh: '猫看猫。', en: 'A cat looks at a cat.', ids: [3] };
    expect(findCloze([twice], '猫')).toBeNull();
    expect(findCloze([twice, ...EXAMPLES], '猫')?.sentence.zh).toBe('我喜欢猫。');
  });

  it('uses recognition questions for retry rounds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const read = buildQuestion({ word: byName('水'), facet: 'read', repetition: 5, retry: true }, resources({ examples: EXAMPLES }), mulberry32(seed));
      expect(['mcq-hanzi-vi', 'mcq-vi-hanzi']).toContain(read.type);
      const listen = buildQuestion({ word: byName('水'), facet: 'listen', repetition: 5, retry: true }, resources(), mulberry32(seed));
      expect(listen.type).toBe('listen-hanzi');
    }
  });
});

describe('speaking questions', () => {
  const rng = () => mulberry32(11);

  it('changes the prompt with repetition and asks for a sentence later', () => {
    const modes = [0, 1, 2, 4].map((repetition) => {
      const question = buildQuestion({ word: byName('猫'), facet: 'speak', repetition }, resources({ examples: EXAMPLES }), rng());
      expect(question.type).toBe('speak');
      return question.kind === 'speak' ? question.mode : null;
    });
    expect(modes).toEqual(['echo', 'from-meaning', 'from-hanzi', 'sentence']);
  });

  it('falls back to the characters when there is no example sentence', () => {
    const question = buildQuestion({ word: byName('猫'), facet: 'speak', repetition: 5 }, resources(), rng());
    expect(question.kind === 'speak' && question.mode).toBe('from-hanzi');
  });

  it('plays the model only for the echo prompt', () => {
    const echo = buildQuestion({ word: byName('猫'), facet: 'speak', repetition: 0 }, resources(), rng());
    expect(echo.autoPlay).toBe(true);
    const later = buildQuestion({ word: byName('猫'), facet: 'speak', repetition: 2 }, resources(), rng());
    expect(later).toMatchObject({ autoPlay: false, promptAudio: 'word' });
  });
});

describe('random sessions', () => {
  it('always builds a valid question for every facet and repetition', () => {
    let built = 0;
    for (let seed = 0; seed < 150; seed++) {
      const rng = mulberry32(seed);
      const target = WORDS[seed % WORDS.length] as Word;
      for (const facet of ['read', 'listen'] as Facet[]) {
        for (let repetition = 0; repetition <= 6; repetition++) {
          const question = buildQuestion(
            { word: target, facet, repetition },
            resources({ examples: target.simplified === '猫' ? EXAMPLES : [], geminiAvailable: seed % 2 === 0, hasImage: seed % 3 === 0 }),
            rng,
          );
          if (question.kind === 'choice') assertChoice(question);
          if (facet === 'listen') expect(['listen-hanzi', 'listen-meaning', 'listen-tone', 'pinyin-dictation', 'sentence-order', 'sentence-dictation']).toContain(question.type);
          built++;
        }
      }
    }
    expect(built).toBe(150 * 2 * 7);
  });
});
