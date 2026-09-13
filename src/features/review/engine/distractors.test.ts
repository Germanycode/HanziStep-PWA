import { describe, expect, it } from 'vitest';
import { toNumbered } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { acceptedReadings } from '@/chinese/pinyin/sandhi';
import { SYLLABLE_SET } from '@/chinese/pinyin/syllables';
import { mulberry32 } from '@/lib/random';
import {
  classifierDistractors,
  glossesOverlap,
  hanziDistractors,
  mainGloss,
  meaningDistractors,
  pinyinDistractors,
  soundAlikeDistractors,
  syllableConfusions,
  tonePatternDistractors,
  type DistractorCandidate,
} from './distractors';

let nextId = 0;
const word = (simplified: string, pinyinNum: string, meaningVi: string[], pos = ['n'], hskLevel = 1): DistractorCandidate => ({
  id: `w${nextId++}`,
  simplified,
  pinyinNum,
  meaningVi,
  pos,
  hskLevel,
});

const POOL: DistractorCandidate[] = [
  word('高兴', 'gao1 xing4', ['vui mừng', 'vui vẻ'], ['a']),
  word('快乐', 'kuai4 le4', ['vui vẻ', 'hạnh phúc'], ['a']),
  word('开心', 'kai1 xin1', ['vui vẻ'], ['a']),
  word('买', 'mai3', ['mua'], ['v']),
  word('卖', 'mai4', ['bán'], ['v']),
  word('银行', 'yin2 hang2', ['ngân hàng'], ['n']),
  word('学校', 'xue2 xiao4', ['trường học'], ['n']),
  word('学生', 'xue2 sheng5', ['học sinh'], ['n']),
  word('老师', 'lao3 shi1', ['thầy giáo', 'cô giáo'], ['n']),
  word('医生', 'yi1 sheng1', ['bác sĩ'], ['n']),
  word('大', 'da4', ['to', 'lớn'], ['a']),
  word('太', 'tai4', ['quá'], ['d']),
  word('天', 'tian1', ['trời', 'ngày'], ['n']),
  word('水', 'shui3', ['nước'], ['n']),
  word('吃', 'chi1', ['ăn'], ['v']),
  word('喝', 'he1', ['uống'], ['v']),
  word('书', 'shu1', ['sách'], ['n']),
  word('朋友', 'peng2 you5', ['bạn bè'], ['n']),
];

describe('meaning overlap', () => {
  it('detects synonyms and contained glosses but not unrelated words', () => {
    expect(mainGloss(['(động từ) ăn; dùng bữa'])).toBe('ăn');
    expect(glossesOverlap(['vui mừng', 'vui vẻ'], ['vui vẻ', 'hạnh phúc'])).toBe(true);
    expect(glossesOverlap(['thầy giáo'], ['giáo viên', 'thầy giáo'])).toBe(true);
    expect(glossesOverlap(['vui'], ['vui vẻ'])).toBe(true);
    expect(glossesOverlap(['ngân hàng'], ['hàng hoá'])).toBe(false);
    expect(glossesOverlap(['mua'], ['bán'])).toBe(false);
  });
});

describe('distractor properties (many seeds)', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => i + 1);

  it('meaning options never contain a second correct answer or duplicates', () => {
    for (const seed of seeds) {
      for (const target of POOL) {
        const picked = meaningDistractors(target, POOL, 3, mulberry32(seed));
        expect(picked).toHaveLength(3);
        const glosses = [target, ...picked].map((candidate) => candidate.meaningVi);
        for (let i = 0; i < glosses.length; i++) {
          for (let j = i + 1; j < glosses.length; j++) expect(glossesOverlap(glosses[i] ?? [], glosses[j] ?? [])).toBe(false);
        }
      }
    }
  });

  it('prefers the same part of speech', () => {
    const target = POOL.find((candidate) => candidate.simplified === '吃') as DistractorCandidate;
    const picked = meaningDistractors(target, POOL, 2, mulberry32(7));
    expect(picked.every((candidate) => candidate.pos.includes('v'))).toBe(true);
  });

  it('hanzi options are unique, never the answer, and prefer same length with shared characters', () => {
    const target = POOL.find((candidate) => candidate.simplified === '学生') as DistractorCandidate;
    for (const seed of seeds) {
      const picked = hanziDistractors(target, POOL, 3, mulberry32(seed));
      expect(new Set(picked.map((candidate) => candidate.simplified)).size).toBe(3);
      expect(picked.some((candidate) => candidate.simplified === '学生')).toBe(false);
      expect(picked.every((candidate) => [...candidate.simplified].length === 2)).toBe(true);
    }
    expect(hanziDistractors(target, POOL, 1, mulberry32(3))[0]?.simplified).toBe('学校');
  });

  it('sound-alike options prefer same syllables and exclude exact homophones', () => {
    const target = POOL.find((candidate) => candidate.simplified === '买') as DistractorCandidate;
    const homophone = word('麦', 'mai4', ['lúa mì'], ['n']);
    const same = word('埋', 'mai3', ['chôn'], ['v']);
    const picked = soundAlikeDistractors(target, [...POOL, homophone, same], 3, mulberry32(1));
    expect(picked[0]?.pinyinNum.replace(/\d/g, '')).toBe('mai');
    expect(picked.some((candidate) => candidate.pinyinNum === 'mai3')).toBe(false);
    expect(new Set(picked.map((candidate) => candidate.pinyinNum)).size).toBe(picked.length);
  });

  it('pinyin options are valid syllables and never an accepted reading (sandhi included)', () => {
    for (const [hanzi, pinyin] of [
      ['你好', 'ni3 hao3'],
      ['知道', 'zhi1 dao4'],
      ['女儿', 'nü3 er2'],
      ['银行', 'yin2 hang2'],
    ] as const) {
      const syllables = parsePinyin(pinyin).syllables;
      const accepted = acceptedReadings(syllables, hanzi).map((reading) => toNumbered(reading));
      for (const seed of seeds) {
        const options = pinyinDistractors(syllables, accepted, 3, mulberry32(seed));
        expect(options).toHaveLength(3);
        expect(new Set(options).size).toBe(3);
        for (const option of options) {
          expect(accepted).not.toContain(option);
          const parsed = parsePinyin(option);
          expect(parsed.errors).toEqual([]);
          expect(parsed.syllables).toHaveLength(syllables.length);
          expect(parsed.syllables.every((syllable) => SYLLABLE_SET.has(syllable.base))).toBe(true);
        }
      }
    }
  });

  it('suggests confusable initials and finals', () => {
    const { tones, sounds } = syllableConfusions({ base: 'zhang', tone: 1 });
    expect(tones.map((syllable) => syllable.tone)).toEqual([2, 3, 4]);
    expect(sounds.map((syllable) => syllable.base).sort()).toEqual(['zang', 'zhan']);
    expect(syllableConfusions({ base: 'nü', tone: 3 }).sounds.map((syllable) => syllable.base)).toContain('nu');
    expect(syllableConfusions({ base: 'zi', tone: 4 }).sounds.map((syllable) => syllable.base)).toContain('zhi');
  });

  it('tone patterns change one syllable and exclude the answer', () => {
    const target = parsePinyin('mai3 cai4').syllables;
    for (const seed of seeds) {
      const options = tonePatternDistractors(target, 3, mulberry32(seed));
      expect(options).toHaveLength(3);
      expect(options).not.toContain('3-4');
      expect(options.every((option) => option.split('-').filter((tone, i) => tone !== ['3', '4'][i]).length === 1)).toBe(true);
    }
  });

  it('measure-word options exclude every correct classifier', () => {
    const options = classifierDistractors(['本', '个'], 3, mulberry32(4));
    expect(options).toHaveLength(3);
    expect(options).not.toContain('本');
    expect(options).not.toContain('个');
  });
});
