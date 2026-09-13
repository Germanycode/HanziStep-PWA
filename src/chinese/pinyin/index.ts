export { comparePinyin, type PinyinComparison } from './compare';
export { stripToneMarks, syllableToMarks, syllableToNumbered, toMarks, toNumbered, toneMarkIndex } from './marks';
export { parsePinyin, type ParseResult } from './parse';
export { acceptedReadings, applySandhi } from './sandhi';
export { isValidSyllable, SYLLABLES, syllableAudioKey } from './syllables';
export type { PinyinTone, Syllable } from './types';

import { toMarks } from './marks';
import { parsePinyin } from './parse';

/** Convenience: numbered or marked pinyin → marked pinyin ("ni3 hao3" → "nǐ hǎo"). */
export function pinyinToMarks(input: string): string {
  return toMarks(parsePinyin(input).syllables);
}
