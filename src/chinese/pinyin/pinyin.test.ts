import { describe, expect, it } from 'vitest';
import {
  acceptedReadings,
  applySandhi,
  comparePinyin,
  parsePinyin,
  pinyinToMarks,
  stripToneMarks,
  syllableAudioKey,
  SYLLABLES,
  toMarks,
  toNumbered,
} from './index';

const syllables = (input: string) => parsePinyin(input).syllables;

describe('syllable table', () => {
  it('has the standard syllables and no non-standard spellings', () => {
    expect(SYLLABLES.length).toBe(414);
    expect(SYLLABLES).toContain('zhuang');
    expect(SYLLABLES).toContain('lüe');
    expect(SYLLABLES).toContain('r');
    expect(SYLLABLES).not.toContain('jv');
    expect(new Set(SYLLABLES).size).toBe(SYLLABLES.length);
    expect(syllableAudioKey('nüe')).toBe('nve');
  });
});

describe('parsePinyin', () => {
  it.each([
    ['ni3hao3', 'ni3 hao3'],
    ['ni3 hao3', 'ni3 hao3'],
    ['nǐhǎo', 'ni3 hao3'],
    ['Nǐ Hǎo!', 'ni3 hao3'],
    ['NI3 HAO3', 'ni3 hao3'],
    ['wo3 ai4 ni3', 'wo3 ai4 ni3'],
    ['zhōngguó', 'zhong1 guo2'],
    ['māma', 'ma1 ma5'],
    ['ma0', 'ma5'],
    ['ma5', 'ma5'],
    ['xie4xie', 'xie4 xie5'],
    ['lv3', 'lü3'],
    ['lu:3', 'lü3'],
    ['lü3', 'lü3'],
    ['lǚ', 'lü3'],
    ['nüe4', 'nüe4'],
    ['nve4', 'nüe4'],
    ['nüè', 'nüe4'],
    ['jv4', 'ju4'],
    ['qü1', 'qu1'],
    ['xuě', 'xue3'],
    ["xi1'an1", 'xi1 an1'],
    ["Xī'ān", 'xi1 an1'],
    ['xian1', 'xian1'],
    ['Tiān’ānmén', 'tian1 an1 men2'],
    ['tian1an1men2', 'tian1 an1 men2'],
    // A digit only tones the syllable right before it; "an" has no tone, so it is neutral.
    ['tian1anmen2', 'tian1 an5 men2'],
    ['er2', 'er2'],
    ['yi1xia4r5', 'yi1 xia4 r5'],
    ['yīxiàr', 'yi1 xia4 r5'],
    ['shuang1', 'shuang1'],
    ['zhuàng', 'zhuang4'],
    ['yī-èr-sān', 'yi1 er4 san1'],
    ['guǐ', 'gui3'],
    ['liù', 'liu4'],
    ['nǐ', 'ni3'],
    ['lǚ', 'lü3'],
  ])('reads %s as %s', (input, expected) => {
    const result = parsePinyin(input);
    expect(result.errors).toEqual([]);
    expect(toNumbered(result.syllables)).toBe(expected);
  });

  it('marks toneless input as having no tone information', () => {
    expect(parsePinyin('nihao')).toEqual({
      syllables: [
        { base: 'ni', tone: 5 },
        { base: 'hao', tone: 5 },
      ],
      errors: [],
      hasToneInfo: false,
    });
    expect(parsePinyin('ni3hao3').hasToneInfo).toBe(true);
    expect(parsePinyin('ma5').hasToneInfo).toBe(false);
  });

  it('reports what it cannot read', () => {
    expect(parsePinyin('abc3').errors).toHaveLength(1);
    expect(parsePinyin('zhx').errors).toHaveLength(1);
    expect(parsePinyin('3').errors).toHaveLength(1);
    // Two tone marks inside one syllable ("hǎǒ") is an error; "mǎà" is simply mǎ + à.
    expect(parsePinyin('hǎǒ').errors).toHaveLength(1);
    expect(toNumbered(parsePinyin('mǎà').syllables)).toBe('ma3 a4');
    expect(parsePinyin('').syllables).toEqual([]);
  });

  it('keeps the readable parts when some input is invalid', () => {
    const result = parsePinyin('ni3 qqq hao3');
    expect(toNumbered(result.syllables)).toBe('ni3 hao3');
    expect(result.errors).toHaveLength(1);
  });
});

describe('tone marks', () => {
  it.each([
    ['ni3 hao3', 'nǐ hǎo'],
    ['lü3', 'lǚ'],
    ['lüe4', 'lüè'],
    ['nü3', 'nǚ'],
    ['liu4', 'liù'],
    ['gui3', 'guǐ'],
    ['dou1', 'dōu'],
    ['xue2', 'xué'],
    ['er2', 'ér'],
    ['ma5', 'ma'],
    ['yi1 xia4 r5', 'yī xià r'],
    ['zhuang1', 'zhuāng'],
    ['huai4', 'huài'],
    ['shei2', 'shéi'],
    ['jiong3', 'jiǒng'],
    ['qu4', 'qù'],
    ['yue4', 'yuè'],
    ['ou1', 'ōu'],
    ['o2', 'ó'],
  ])('writes %s as %s', (input, expected) => {
    expect(toMarks(syllables(input))).toBe(expected);
  });

  it('converts marks back to numbers in several styles', () => {
    expect(toNumbered(syllables('lǚ'), { ue: 'v' })).toBe('lv3');
    expect(toNumbered(syllables('lǚ'), { ue: 'u:' })).toBe('lu:3');
    expect(toNumbered(syllables('māma'), { neutral: '' })).toBe('ma1 ma');
    expect(toNumbered(syllables('māma'), { neutral: '0' }, '')).toBe('ma1ma0');
    expect(pinyinToMarks('Zhong1guo2')).toBe('zhōng guó');
    expect(stripToneMarks('nǐ hǎo, lǚ')).toBe('ni hao, lü');
  });
});

describe('comparePinyin', () => {
  it('accepts an exact answer', () => {
    expect(comparePinyin([syllables('ni3 hao3')], syllables('nǐhǎo'))).toMatchObject({ ok: true, matchedIndex: 0 });
  });

  it('separates tone errors from syllable errors', () => {
    expect(comparePinyin([syllables('mai3')], syllables('mai4'))).toMatchObject({ ok: false, toneErrors: [0], segmentErrors: [] });
    expect(comparePinyin([syllables('zhi1 dao4')], syllables('zi1 dao4'))).toMatchObject({
      ok: false,
      toneErrors: [],
      segmentErrors: [0],
    });
    expect(comparePinyin([syllables('ni3 hao3')], syllables('ni3'))).toMatchObject({ ok: false, segmentErrors: [0, 1] });
  });

  it('ignores tones in easy mode', () => {
    expect(comparePinyin([syllables('ni3 hao3')], syllables('nihao'), { ignoreTones: true }).ok).toBe(true);
  });

  it('accepts any of several readings and reports the closest', () => {
    const accepted = acceptedReadings(syllables('ni3 hao3'), '你好');
    expect(comparePinyin(accepted, syllables('ni2 hao3'))).toMatchObject({ ok: true, matchedIndex: 1 });
    expect(comparePinyin(accepted, syllables('ni4 hao3'))).toMatchObject({ ok: false, toneErrors: [0] });
    expect(comparePinyin([], syllables('ni3'))).toMatchObject({ ok: false, matchedIndex: -1 });
  });
});

describe('applySandhi', () => {
  it.each([
    ['你好', 'ni3 hao3', 'ni2 hao3'],
    ['我很好', 'wo3 hen3 hao3', 'wo2 hen2 hao3'],
    ['不是', 'bu4 shi4', 'bu2 shi4'],
    ['不好', 'bu4 hao3', 'bu4 hao3'],
    ['一个', 'yi1 ge4', 'yi2 ge4'],
    ['一天', 'yi1 tian1', 'yi4 tian1'],
    ['一起', 'yi1 qi3', 'yi4 qi3'],
    ['一年', 'yi1 nian2', 'yi4 nian2'],
    ['第一', 'di4 yi1', 'di4 yi1'],
    ['老师', 'lao3 shi1', 'lao3 shi1'],
  ])('%s: %s → %s', (hanzi, citation, spoken) => {
    expect(toNumbered(applySandhi(syllables(citation), hanzi))).toBe(spoken);
  });

  it('only applies the 不/一 rules when characters are given', () => {
    expect(toNumbered(applySandhi(syllables('bu4 shi4')))).toBe('bu4 shi4');
    expect(toNumbered(applySandhi(syllables('ni3 hao3')))).toBe('ni2 hao3');
  });

  it('lists the citation and spoken readings once each', () => {
    expect(acceptedReadings(syllables('ni3 hao3'), '你好').map((reading) => toNumbered(reading))).toEqual(['ni3 hao3', 'ni2 hao3']);
    expect(acceptedReadings(syllables('lao3 shi1'), '老师')).toHaveLength(1);
  });
});
