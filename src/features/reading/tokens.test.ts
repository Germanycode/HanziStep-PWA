import { describe, expect, it } from 'vitest';
import { segmentSentence } from '@/chinese/segment/segment';
import { createLexicon } from '@/chinese/segment/types';
import type { DictEntry } from '@/domain/types';
import { knownShare, readSentence, tokenPinyin, tokenStatus, type PinyinLookup, type StatusLookup } from './tokens';

function entry(s: string, p: string, vi: string[] = []): DictEntry {
  return { s, t: s, p, pt: p.replace(/\d/g, ''), en: [], vi, cl: [] };
}

const ENTRIES: DictEntry[] = [
  entry('银行', 'yin2 hang2', ['ngân hàng']),
  entry('行走', 'xing2 zou3', ['đi bộ']),
  entry('行', 'hang2', ['hàng']),
  entry('我', 'wo3'),
  entry('很', 'hen3'),
  entry('好', 'hao3'),
  entry('你', 'ni3'),
  entry('你好', 'ni3 hao3', ['xin chào']),
  entry('去', 'qu4'),
  entry('猫', 'mao1', ['con mèo']),
  entry('不', 'bu4'),
  entry('是', 'shi4'),
];

const dict = new Map<string, DictEntry[]>();
for (const item of ENTRIES) dict.set(item.s, [...(dict.get(item.s) ?? []), item]);

const LOOKUP: PinyinLookup = { dict };
const LEXICON = createLexicon(dict.keys());

const readingOf = (sentence: string, lookup: PinyinLookup = LOOKUP) =>
  readSentence(segmentSentence(sentence, LEXICON), lookup)
    .filter((token) => token.kind === 'word')
    .map((token) => token.pinyinNum);

describe('tokenPinyin', () => {
  it('reads the whole token, so context picks the pronunciation', () => {
    expect(tokenPinyin('银行', LOOKUP)).toBe('yin2 hang2');
    expect(tokenPinyin('行走', LOOKUP)).toBe('xing2 zou3');
    expect(tokenPinyin('行', LOOKUP)).toBe('hang2');
  });

  it('prefers the HSK reading when there is one', () => {
    const withHsk: PinyinLookup = { dict, hsk: new Map([['行', 'xing2']]) };
    expect(tokenPinyin('行', withHsk)).toBe('xing2');
    expect(tokenPinyin('银行', withHsk)).toBe('yin2 hang2');
  });

  it('returns null for unknown words', () => {
    expect(tokenPinyin('謎语', LOOKUP)).toBeNull();
  });
});

describe('readSentence', () => {
  it('gives 银行 and 行走 their context readings in one sentence', () => {
    expect(readingOf('我去银行。')).toEqual(['wo3', 'qu4', 'yin2 hang2']);
    expect(readingOf('我行走。')).toEqual(['wo3', 'xing2 zou3']);
  });

  it('applies third-tone sandhi inside and across words', () => {
    expect(readingOf('你好。')).toEqual(['ni2 hao3']);
    expect(readingOf('我很好。')).toEqual(['wo2', 'hen2', 'hao3']);
  });

  it('applies the 不 rule across neighbouring words and stops a run at punctuation', () => {
    // 不 and 是 are separate tokens here, so this also proves sandhi crosses word boundaries.
    expect(readingOf('不是')).toEqual(['bu2', 'shi4']);
    // 好，好 — the comma ends the run, so neither 好 changes.
    expect(readingOf('好，好')).toEqual(['hao3', 'hao3']);
  });

  it('keeps the citation reading alongside the spoken one', () => {
    const tokens = readSentence(segmentSentence('你好', LEXICON), LOOKUP);
    expect(tokens[0]).toMatchObject({ citation: 'ni3 hao3', pinyinNum: 'ni2 hao3' });
  });

  it('leaves punctuation and unknown words without a reading', () => {
    const tokens = readSentence(segmentSentence('我谜。', LEXICON), LOOKUP);
    expect(tokens.map((token) => token.pinyinNum)).toEqual(['wo3', '', '']);
  });
});

describe('tokenStatus', () => {
  const lookup: StatusLookup = {
    saved: new Map([
      ['银行', { repetition: 4, known: false }],
      ['猫', { repetition: 1, known: false }],
      ['你好', { repetition: 0, known: true }],
      ['去', { repetition: -1, known: false }],
    ]),
    targets: new Set(['行走']),
    inDictionary: (word) => dict.has(word),
  };
  const statusOf = (text: string) => tokenStatus({ text, start: 0, end: text.length, kind: 'word' }, lookup);

  it('follows the mastery rules', () => {
    expect(statusOf('银行')).toBe('known');
    expect(statusOf('你好')).toBe('known');
    expect(statusOf('猫')).toBe('learning');
    expect(statusOf('行走')).toBe('target');
    expect(statusOf('去')).toBe('new');
    expect(statusOf('谜语')).toBe('unknown');
  });

  it('ignores punctuation', () => {
    expect(tokenStatus({ text: '。', start: 0, end: 1, kind: 'punct' }, lookup)).toBe('other');
  });

  it('measures the share of known content tokens', () => {
    expect(knownShare(['known', 'known', 'new', 'other'])).toBeCloseTo(2 / 3);
    expect(knownShare(['other'])).toBe(1);
  });
});
