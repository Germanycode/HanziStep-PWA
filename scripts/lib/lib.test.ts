// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractClassifiers, parseCedict, parseCedictLine } from './cedict';
import { pinyinKey, splitSyllable, tonelessKey } from './pinyin';
import { hanChars, parseManythingsLine, sentenceLevel } from './sentences';
import { parseUnihanVietnamese } from './unihan';

describe('parseCedictLine', () => {
  it('parses entries and ignores comments or malformed lines', () => {
    expect(parseCedictLine('銀行 银行 [yin2 hang2] /bank/CL:家[jia1],個|个[ge4]/')).toEqual({
      trad: '銀行',
      simp: '银行',
      pinyin: 'yin2 hang2',
      glosses: ['bank', 'CL:家[jia1],個|个[ge4]'],
    });
    expect(parseCedictLine('% % [pa1] /phần trăm (Đài Loan)/')?.glosses).toEqual(['phần trăm (Đài Loan)']);
    expect(parseCedictLine('#! entries=122591')).toBeNull();
    expect(parseCedictLine('not a dictionary line')).toBeNull();
  });

  it('parses a whole file', () => {
    const text = '# header\n人 人 [ren2] /person/\r\n\n女 女 [nu:3] /female/\n';
    expect(parseCedict(text).map((entry) => entry.simp)).toEqual(['人', '女']);
  });
});

describe('extractClassifiers', () => {
  it('moves CL: glosses into simplified classifiers', () => {
    expect(extractClassifiers(['person', 'people', 'CL:個|个[ge4],位[wei4]'])).toEqual({
      glosses: ['person', 'people'],
      classifiers: ['个', '位'],
    });
    expect(extractClassifiers(['no classifier'])).toEqual({ glosses: ['no classifier'], classifiers: [] });
  });

  it('also strips CVDICT "LT:" classifier glosses', () => {
    expect(extractClassifiers(['giáo viên', 'LT: 個|个[ge4], 位[wei4]'])).toEqual({
      glosses: ['giáo viên'],
      classifiers: ['个', '位'],
    });
  });
});

describe('pinyin helpers', () => {
  it('normalizes join keys', () => {
    expect(pinyinKey('Nu:3  ren2')).toBe('nv3 ren2');
    expect(pinyinKey('lü3')).toBe('lv3');
    expect(tonelessKey('yin2 hang2')).toBe('yinhang');
  });

  it('splits syllables into initial and final', () => {
    expect(splitSyllable('zhuang')).toEqual({ initial: 'zh', final: 'uang' });
    expect(splitSyllable('an')).toEqual({ initial: '', final: 'an' });
    expect(splitSyllable('er')).toEqual({ initial: '', final: 'er' });
    expect(splitSyllable('lv')).toEqual({ initial: 'l', final: 'v' });
    expect(splitSyllable('yong')).toEqual({ initial: 'y', final: 'ong' });
  });
});

describe('Unihan', () => {
  it('reads kVietnamese values only', () => {
    const text = '# comment\nU+4E2D\tkVietnamese\ttrung trúng\nU+4E2D\tkMandarin\tzhōng\nU+5B66\tkVietnamese\thọc';
    const readings = parseUnihanVietnamese(text);
    expect(readings.get('中')).toEqual(['trung', 'trúng']);
    expect(readings.get('学')).toEqual(['học']);
    expect(readings.size).toBe(2);
  });
});

describe('sentences', () => {
  it('counts Han characters only', () => {
    expect(hanChars('我爱你, Tom!')).toHaveLength(3);
  });

  it('finds the lowest level that covers 90% of tokens', () => {
    expect(sentenceLevel([1, 1, 2, 3])).toBe(3);
    expect(sentenceLevel([1, 1, 1, 1, 1, 1, 1, 1, 1, null])).toBe(1);
    expect(sentenceLevel([1, 1, 2, null, 3])).toBeNull();
    expect(sentenceLevel([])).toBeNull();
  });

  it('parses manythings lines with Tatoeba ids', () => {
    expect(
      parseManythingsLine('Hi.\t你好。\tCC-BY 2.0 (France) Attribution: tatoeba.org #538123 (CM) & #891077 (Martha)'),
    ).toEqual({ en: 'Hi.', zh: '你好。', ids: [538123, 891077] });
    expect(parseManythingsLine('only one column')).toBeNull();
  });
});
