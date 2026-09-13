import { describe, expect, it } from 'vitest';
import { charAccuracy, containsWordToken, lcsLength, sentenceTiles, stripForComparison } from './text';

describe('sentenceTiles', () => {
  it('keeps every character and attaches punctuation to the previous tile', () => {
    const sentence = '我们一起学习汉语。';
    const tiles = sentenceTiles(sentence);
    expect(tiles.join('')).toBe(sentence);
    expect(tiles.length).toBeGreaterThan(2);
    expect(tiles.at(-1)?.endsWith('。')).toBe(true);
    expect(tiles.some((tile) => tile === '。')).toBe(false);
  });

  it('drops spaces', () => {
    expect(sentenceTiles('你好 ， Tom ！').join('')).toBe('你好，Tom！');
  });
});

describe('containsWordToken', () => {
  it('matches whole segmented words only', () => {
    expect(containsWordToken('我们学习。', '学习')).toBe(true);
    expect(containsWordToken('我们学习。', '习')).toBe(false);
  });
});

describe('character accuracy', () => {
  it('computes the longest common subsequence', () => {
    expect(lcsLength('abcde', 'ace')).toBe(3);
    expect(lcsLength('', 'abc')).toBe(0);
    expect(lcsLength('我爱你', '我你')).toBe(2);
  });

  it('ignores punctuation and penalises missing or extra characters', () => {
    expect(stripForComparison('你好，Tom！')).toBe('你好tom');
    expect(charAccuracy('我爱你。', '我爱你')).toBe(1);
    expect(charAccuracy('我爱你', '我你')).toBeCloseTo(2 / 3);
    expect(charAccuracy('我爱你', '我爱你们')).toBeCloseTo(3 / 4);
    expect(charAccuracy('', '')).toBe(1);
    expect(charAccuracy('我', '')).toBe(0);
  });
});
