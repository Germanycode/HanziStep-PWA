import { describe, expect, it } from 'vitest';
import { classifyToken, longestMatchAt, longestWordAt, segmentSentence } from './segment';
import { splitSentences } from './sentences';
import { createLexicon, EMPTY_LEXICON } from './types';

const LEXICON = createLexicon([
  '我',
  '你',
  '他',
  '去',
  '很',
  '快',
  '银行',
  '行走',
  '行',
  '中国人',
  '中国',
  '中',
  '国',
  '人',
  '喜欢',
  '猫',
  '工作',
  '在',
  '北京',
]);

const texts = (tokens: { text: string }[]) => tokens.map((token) => token.text);

describe('segmentSentence', () => {
  it('keeps 银行 together and does not cut 行走', () => {
    expect(texts(segmentSentence('我去银行。', LEXICON))).toEqual(['我', '去', '银行', '。']);
    expect(texts(segmentSentence('他行走很快', LEXICON))).toEqual(['他', '行走', '很', '快']);
  });

  it('covers the whole sentence with contiguous offsets', () => {
    const sentence = '我喜欢猫，他在北京工作。';
    const tokens = segmentSentence(sentence, LEXICON);
    expect(tokens.map((token) => token.text).join('')).toBe(sentence);
    let cursor = 0;
    for (const token of tokens) {
      expect(token.start).toBe(cursor);
      cursor = token.end;
    }
    expect(cursor).toBe(sentence.length);
  });

  it('labels punctuation, digits and Latin letters', () => {
    const tokens = segmentSentence('我有2个 App。', LEXICON);
    const kinds = new Map(tokens.map((token) => [token.text, token.kind]));
    expect(kinds.get('。')).toBe('punct');
    expect(kinds.get('2')).toBe('num');
    expect(kinds.get('App')).toBe('latin');
    expect(classifyToken('我')).toBe('word');
    expect(classifyToken(' ')).toBe('space');
  });

  it('splits unknown runs into the longest known words', () => {
    // 中国人 is known as a whole, but with a smaller lexicon it becomes 中国 + 人.
    const smaller = createLexicon(['中国', '人']);
    expect(texts(segmentSentence('中国人', smaller))).toEqual(['中国', '人']);
  });

  it('applies merge and split overrides', () => {
    expect(texts(segmentSentence('中国人', LEXICON))).toEqual(['中国人']);
    // 国人 is not a word here, so the rest of the run is re-segmented by longest match.
    expect(texts(segmentSentence('中国人', LEXICON, [[0, 1]]))).toEqual(['中', '国', '人']);
    expect(texts(segmentSentence('中国人', LEXICON, [[1, 3]]))).toEqual(['中', '国人']);
    expect(texts(segmentSentence('我去银行。', LEXICON, [[2, 3]]))).toEqual(['我', '去', '银', '行', '。']);
  });

  it('never merges across a forced boundary', () => {
    const tokens = segmentSentence('我去银行。', LEXICON, [[3, 4]]);
    expect(texts(tokens)).toEqual(['我', '去', '银', '行', '。']);
  });

  it('works without a lexicon', () => {
    const tokens = segmentSentence('我去银行。', EMPTY_LEXICON);
    expect(tokens.map((token) => token.text).join('')).toBe('我去银行。');
  });
});

describe('longest match', () => {
  it('offers every length at a position, longest first', () => {
    expect(longestMatchAt('中国人很多', 0, LEXICON)).toEqual(['中国人', '中国', '中']);
    expect(longestMatchAt('银行', 0, LEXICON)).toEqual(['银行', '银']);
    expect(longestMatchAt('猫', 0, LEXICON)).toEqual(['猫']);
  });

  it('stops at non-Han characters', () => {
    expect(longestMatchAt('中。国', 0, LEXICON)).toEqual(['中']);
  });

  it('returns null when even the character is unknown', () => {
    expect(longestWordAt('謎', 0, LEXICON)).toBeNull();
    expect(longestWordAt('银行', 0, LEXICON)).toBe('银行');
  });
});

describe('splitSentences', () => {
  it('keeps the ending punctuation and closing quotes', () => {
    expect(splitSentences('你好。他说：「走吧！」我们走了。').map((span) => span.text)).toEqual([
      '你好。',
      '他说：「走吧！」',
      '我们走了。',
    ]);
  });

  it('splits on line breaks and drops empty lines', () => {
    expect(splitSentences('第一行\n\n第二行').map((span) => span.text)).toEqual(['第一行', '第二行']);
  });

  it('reports offsets into the original text', () => {
    const text = '你好。再见。';
    const spans = splitSentences(text);
    expect(spans.map((span) => text.slice(span.start, span.end))).toEqual(['你好。', '再见。']);
  });

  it('cuts very long runs after a comma that fits', () => {
    const long = `${'我们'.repeat(10)}，${'他们'.repeat(20)}`;
    const spans = splitSentences(long, 30);
    expect(spans.length).toBeGreaterThan(1);
    expect(spans.map((span) => span.text).join('')).toBe(long);
    expect(spans[0]?.text.endsWith('，')).toBe(true);
  });

  it('falls back to a hard cut when no comma fits', () => {
    const long = '我们'.repeat(40);
    const spans = splitSentences(long, 30);
    expect(spans.map((span) => span.text).join('')).toBe(long);
    expect(spans.every((span) => span.text.length <= 30)).toBe(true);
  });

  it('returns nothing for blank text', () => {
    expect(splitSentences('   \n  ')).toEqual([]);
  });
});
