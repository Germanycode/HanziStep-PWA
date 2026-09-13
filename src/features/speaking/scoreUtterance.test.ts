import { describe, expect, it } from 'vitest';
import { normalizeTranscript, scoreUtterance } from './scoreUtterance';

const READINGS: Record<string, string> = {
  买: 'mai3',
  卖: 'mai4',
  猫: 'mao1',
  我: 'wo3',
  想: 'xiang3',
  你好: 'ni3 hao3',
  你: 'ni3',
  好: 'hao3',
  我想买: 'wo3 xiang3 mai3',
  我想卖: 'wo3 xiang3 mai4',
  我想猫: 'wo3 xiang3 mao1',
};

const readingOf = (text: string): string =>
  READINGS[text] ?? [...text].map((char) => READINGS[char] ?? '').filter(Boolean).join(' ');

describe('normalizeTranscript', () => {
  it('drops punctuation and spaces', () => {
    expect(normalizeTranscript('我 想买。')).toBe('我想买');
  });

  it('writes digits as characters', () => {
    expect(normalizeTranscript('我有2个')).toBe('我有二个');
    expect(normalizeTranscript('３个')).toBe('三个');
  });

  it('folds traditional characters when a mapping is given', () => {
    expect(normalizeTranscript('銀行', (char) => ({ 銀: '银', 行: '行' })[char] ?? char)).toBe('银行');
  });
});

describe('scoreUtterance', () => {
  const target = { hanzi: '我想买', pinyinNum: 'wo3 xiang3 mai3' };

  it('gives 4 for the right characters on the first try, 3 on the second', () => {
    expect(scoreUtterance(target, ['我想买。'], { readingOf })).toMatchObject({
      charMatch: true,
      quality: 4,
      perSyllable: ['match', 'match', 'match'],
    });
    expect(scoreUtterance(target, ['我想买'], { readingOf, attempt: 2 }).quality).toBe(3);
  });

  it('treats a homophone as 3 and never claims the tone was right', () => {
    const score = scoreUtterance(target, ['我想卖'], { readingOf });
    expect(score).toMatchObject({ charMatch: false, tonelessSyllableMatch: true, quality: 3 });
    expect(score.perSyllable).toEqual(['match', 'match', 'homophone']);
  });

  it('never returns 5, whatever was heard', () => {
    const qualities = [['我想买'], ['我想卖'], ['我想猫'], []].map(
      (alternatives) => scoreUtterance(target, alternatives, { readingOf }).quality,
    );
    expect(qualities.every((quality) => quality <= 4)).toBe(true);
  });

  it('marks a wrong syllable and scores 0 on the first try, 1 on the second', () => {
    const score = scoreUtterance(target, ['我想猫'], { readingOf });
    expect(score.perSyllable).toEqual(['match', 'match', 'wrong']);
    expect(score.quality).toBe(0);
    expect(scoreUtterance(target, ['我想猫'], { readingOf, attempt: 2 }).quality).toBe(1);
  });

  it('reports missing syllables when the learner said less', () => {
    const score = scoreUtterance({ hanzi: '你好', pinyinNum: 'ni3 hao3' }, ['你'], { readingOf });
    expect(score.perSyllable).toEqual(['match', 'missing']);
    expect(score.quality).toBe(0);
  });

  it('handles silence', () => {
    const score = scoreUtterance(target, [], { readingOf });
    expect(score).toMatchObject({ best: '', quality: 0, perSyllable: ['missing', 'missing', 'missing'] });
    expect(scoreUtterance(target, [], { readingOf, attempt: 2 }).quality).toBe(1);
  });

  it('picks the closest alternative when none is exact', () => {
    const score = scoreUtterance(target, ['我想猫', '我想卖'], { readingOf });
    expect(score.best).toBe('我想卖');
    expect(score.quality).toBe(3);
  });
});
