import { describe, expect, it } from 'vitest';
import type { Word } from '@/domain/types';
import { characterFromWord, charactersFromWords, hanCharacters, mergeCharacter } from './characters';

const word = {
  id: '学生:xue2sheng1', simplified: '学生', pinyinNum: 'xue2 sheng1', hanViet: 'HỌC SINH',
  meaningVi: ['học sinh'],
} as Word;

describe('writing character records', () => {
  it('extracts unique Han characters and ignores punctuation', () => {
    expect(hanCharacters('你好，你')).toEqual(['你', '好']);
  });

  it('maps character position to the corresponding syllable and Hán-Việt', () => {
    expect(characterFromWord('生', word, 10)).toMatchObject({
      id: '生', pinyin: ['sheng1'], meaningsVi: [], hanViet: ['SINH'], wordIds: [word.id],
    });
  });

  it('keeps word meanings only when the learned word is one character', () => {
    const single = { ...word, id: '学:xue2', simplified: '学', pinyinNum: 'xue2', hanViet: 'HỌC', meaningVi: ['học'] };
    expect(characterFromWord('学', single, 10).meaningsVi).toEqual(['học']);
  });

  it('parses joined pinyin and keeps every positional reading of a repeated character', () => {
    const city = { ...word, id: '城里:cheng2li3', simplified: '城里', pinyinNum: 'chénglǐ', hanViet: 'THÀNH LÝ' };
    const brother = { ...word, id: '弟弟:di4di5', simplified: '弟弟', pinyinNum: 'di4 di5', hanViet: 'ĐỆ ĐỆ' };
    expect(characterFromWord('里', city, 10).pinyin).toEqual(['li3']);
    expect(characterFromWord('弟', brother, 10).pinyin).toEqual(['di4', 'di5']);
  });

  it('refuses to guess a character reading when glyphs and syllables are misaligned', () => {
    const malformed = { ...word, id: '不一会儿:bu4yi1', simplified: '不一会儿', pinyinNum: 'bu4 yi1', hanViet: '' };
    expect(characterFromWord('会', malformed, 10).pinyin).toEqual([]);
  });

  it('merges sources without duplicates', () => {
    const first = characterFromWord('学', word, 10);
    const second = characterFromWord('学', { ...word, id: '大学:da4xue2', simplified: '大学', pinyinNum: 'da4 xue2', hanViet: 'ĐẠI HỌC' }, 20);
    expect(mergeCharacter(first, second)).toMatchObject({ wordIds: [word.id, '大学:da4xue2'], pinyin: ['xue2'], updatedAt: 20 });
  });

  it('builds one canonical row per character', () => {
    expect(charactersFromWords([word], 10).map((char) => char.id)).toEqual(['学', '生']);
  });
});
