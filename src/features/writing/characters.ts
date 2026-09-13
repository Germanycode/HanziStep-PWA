import type { HanziCharacter, Word } from '@/domain/types';
import { syllableToNumbered } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';

export function hanCharacters(value: string): string[] {
  return [...new Set([...value].filter((character) => /\p{Script=Han}/u.test(character)))];
}

function readingsAtCharacter(character: string, glyphs: readonly string[], readings: readonly string[]): string[] {
  const hanPositions = glyphs.flatMap((glyph, index) => (/\p{Script=Han}/u.test(glyph) ? [index] : []));
  const readingByGlyph = readings.length === glyphs.length;
  const readingByHan = readings.length === hanPositions.length;
  if (!readingByGlyph && !readingByHan) return [];

  return [...new Set(hanPositions.flatMap((glyphIndex, hanIndex) => {
    if (glyphs[glyphIndex] !== character) return [];
    const reading = readings[readingByGlyph ? glyphIndex : hanIndex];
    return reading ? [reading] : [];
  }))];
}

/** Build the small, user-owned character record without depending on remote metadata. */
export function characterFromWord(character: string, word: Word, now = Date.now()): HanziCharacter {
  const glyphs = [...word.simplified];
  const syllables = parsePinyin(word.pinyinNum).syllables.map((syllable) => syllableToNumbered(syllable));
  const hanVietParts = word.hanViet.trim().split(/[\s/]+/).filter(Boolean);
  const characterCount = glyphs.filter((glyph) => /\p{Script=Han}/u.test(glyph)).length;
  return {
    id: character,
    character,
    wordIds: [word.id],
    pinyin: readingsAtCharacter(character, glyphs, syllables),
    // A compound's translation is not the meaning of each component character.
    meaningsVi: characterCount === 1 ? word.meaningVi.slice(0, 2) : [],
    hanViet: readingsAtCharacter(character, glyphs, hanVietParts),
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeCharacter(current: HanziCharacter | undefined, incoming: HanziCharacter): HanziCharacter {
  if (!current) return incoming;
  return {
    ...current,
    wordIds: [...new Set([...current.wordIds, ...incoming.wordIds])],
    pinyin: [...new Set([...current.pinyin, ...incoming.pinyin])],
    meaningsVi: [...new Set([...current.meaningsVi, ...incoming.meaningsVi])].slice(0, 6),
    hanViet: [...new Set([...current.hanViet, ...incoming.hanViet])],
    updatedAt: incoming.updatedAt,
  };
}

/** Rebuilds canonical per-character metadata from word positions. */
export function charactersFromWords(words: readonly Word[], now = Date.now()): HanziCharacter[] {
  const chars = new Map<string, HanziCharacter>();
  for (const word of words) {
    for (const character of hanCharacters(word.simplified)) {
      const incoming = characterFromWord(character, word, now);
      chars.set(character, mergeCharacter(chars.get(character), incoming));
    }
  }
  return [...chars.values()];
}
