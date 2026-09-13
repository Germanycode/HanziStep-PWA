import { describe, expect, it } from 'vitest';
import { intervalLabel } from '@/srs/cards';
import { gradeDictation, gradeHanzi, gradeOrder, gradePinyin, initialsHint } from './grading';

describe('gradePinyin', () => {
  const accepted = ['ni3 hao3', 'ni2 hao3'];

  it('accepts numbers, marks and the sandhi reading', () => {
    expect(gradePinyin('ni3 hao3', accepted).correct).toBe(true);
    expect(gradePinyin('nǐ hǎo', accepted).correct).toBe(true);
    expect(gradePinyin('ní hǎo', accepted).correct).toBe(true);
  });

  it('separates tone-only mistakes from wrong syllables', () => {
    const tone = gradePinyin('ni3 hao4', accepted);
    expect(tone).toMatchObject({ correct: false, toneOnlyError: true, missingTones: false });
    const syllable = gradePinyin('li3 hao3', accepted);
    expect(syllable).toMatchObject({ correct: false, toneOnlyError: false });
  });

  it('flags answers typed without tones, and accepts them in easy mode', () => {
    expect(gradePinyin('ni hao', accepted)).toMatchObject({ correct: false, toneOnlyError: true, missingTones: true });
    expect(gradePinyin('ni hao', accepted, true).correct).toBe(true);
  });

  it('reports input that is not pinyin', () => {
    const result = gradePinyin('', accepted);
    expect(result.correct).toBe(false);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
});

describe('gradeHanzi / gradeOrder / gradeDictation', () => {
  it('ignores spaces and punctuation, accepts traditional answers', () => {
    expect(gradeHanzi(' 银行。', ['银行', '銀行'])).toBe(true);
    expect(gradeHanzi('銀行', ['银行', '銀行'])).toBe(true);
    expect(gradeHanzi('银', ['银行'])).toBe(false);
    expect(gradeHanzi('', ['银行'])).toBe(false);
  });

  it('checks the ordered sentence by its text', () => {
    expect(gradeOrder(['我', '喜欢', '猫。'], '我喜欢猫。')).toBe(true);
    expect(gradeOrder(['喜欢', '我', '猫。'], '我喜欢猫。')).toBe(false);
  });

  it('grades dictation by character accuracy', () => {
    expect(gradeDictation('我喜欢猫', '我喜欢猫。')).toEqual({ accuracy: 1, correct: true });
    const partial = gradeDictation('我喜猫', '我喜欢猫。');
    expect(partial.accuracy).toBeCloseTo(0.75);
    expect(partial.correct).toBe(false);
  });
});

describe('hints and labels', () => {
  it('shows initials as the typing hint', () => {
    expect(initialsHint('zhong1 guo2')).toBe('zh… g…');
    expect(initialsHint('ai4')).toBe('a…');
    expect(initialsHint('xue2 sheng5')).toBe('x… sh…');
  });

  it('describes intervals', () => {
    expect(intervalLabel(20 / (24 * 60))).toBe('20 phút');
    expect(intervalLabel(1)).toBe('1 ngày');
    expect(intervalLabel(21)).toBe('21 ngày');
    expect(intervalLabel(95)).toBe('3 tháng');
    expect(intervalLabel(365)).toBe('1 năm');
  });
});
