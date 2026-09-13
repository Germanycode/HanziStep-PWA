import { describe, expect, it } from 'vitest';
import { hanvietForWord, hanvietPinyinKey, hanvietReading, readingsFor, type HanvietData } from './hanviet';

const data: HanvietData = {
  銀: { yin2: ['ngân'] },
  行: { hang2: ['hàng', 'hạng'], xing2: ['hành'], heng2: ['hạnh'] },
  學: { '*': ['học'] },
  們: { men2: ['môn'] },
  兒: { er2: ['nhi'], r5: ['nhi'] },
  女: { 'nu:3': ['nữ'] },
  因: { yin1: ['nhân'] },
  為: { wei2: ['vi'], wei4: ['vị', 'vì'] },
  晚: { wan3: ['vãn'] },
  上: { shang3: ['thướng'], shang4: ['thượng'] },
  安: { an1: ['an'] },
  英: { ying1: ['an', 'anh'] },
};

const unihanFallback: HanvietData = { 走: { '*': ['tẩu'] } };

describe('hanvietPinyinKey', () => {
  it('writes ü as u: like the source data', () => {
    expect(hanvietPinyinKey('nü3')).toBe('nu:3');
    expect(hanvietPinyinKey('NV3')).toBe('nu:3');
    expect(hanvietPinyinKey('Xue2')).toBe('xue2');
  });
});

describe('readingsFor', () => {
  it('picks the readings that match the pinyin', () => {
    expect(readingsFor(data, '行', 'hang2')).toEqual(['hàng', 'hạng']);
    expect(readingsFor(data, '行', 'xing2')).toEqual(['hành']);
  });

  it('uses the hinted full tone for a neutral tone, or merges all full tones', () => {
    expect(readingsFor(data, '們', 'men5')).toEqual(['môn']);
    expect(readingsFor(data, '上', 'shang5')).toEqual(['thướng', 'thượng']);
    expect(readingsFor(data, '上', 'shang5', () => 4)).toEqual(['thượng']);
  });

  it('falls back to every reading when the pinyin is unknown', () => {
    expect(readingsFor(data, '行', 'hang4')).toEqual(['hàng', 'hạng', 'hành', 'hạnh']);
  });

  it('returns [] for characters without data', () => {
    expect(readingsFor(data, '走', 'zou3')).toEqual([]);
  });
});

describe('hanvietReading', () => {
  it('returns the first reading as best and keeps every candidate', () => {
    expect(hanvietReading(data, '銀行', 'yin2 hang2')).toEqual({ best: 'NGÂN HÀNG', all: 'NGÂN HÀNG/HẠNG' });
    expect(hanvietReading(data, '女兒', 'nu:3 er2')).toEqual({ best: 'NỮ NHI', all: 'NỮ NHI' });
  });

  it('prefers the reading that appears as a whole word in the Vietnamese meaning', () => {
    expect(hanvietForWord(data, '因為', 'yin1 wei4', { context: 'bởi vì' })).toBe('NHÂN VÌ');
    expect(hanvietForWord(data, '因為', 'yin1 wei4')).toBe('NHÂN VỊ');
    // "an" is not a whole word inside "anh ấy", so "anh" wins.
    expect(hanvietForWord(data, '英', 'ying1', { context: 'anh ấy' })).toBe('ANH');
  });

  it('applies the neutral-tone hint', () => {
    const hint = (char: string, base: string) => (char === '上' && base === 'shang' ? 4 : undefined);
    expect(hanvietForWord(data, '晚上', 'wan3 shang5')).toBe('VÃN THƯỚNG');
    expect(hanvietForWord(data, '晚上', 'wan3 shang5', { neutralToneHint: hint })).toBe('VÃN THƯỢNG');
  });

  it('uses the fallback data and marks unknown characters', () => {
    expect(hanvietForWord(data, '行走', 'xing2 zou3', { fallback: unihanFallback })).toBe('HÀNH TẨU');
    expect(hanvietForWord(data, '學生', 'xue2 sheng1')).toBe('HỌC ?');
  });

  it('keeps non-Han characters and survives misaligned pinyin', () => {
    expect(hanvietForWord(data, 'A銀', 'A yin2')).toBe('A NGÂN');
    expect(hanvietReading(data, '銀行', 'yinhang')).toEqual({ best: 'NGÂN HÀNG', all: 'NGÂN HÀNG/HẠNG/HÀNH/HẠNH' });
  });
});
