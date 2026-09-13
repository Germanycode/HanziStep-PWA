import { comparePinyin, type PinyinComparison } from '@/chinese/pinyin/compare';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { charAccuracy, stripForComparison } from '@/chinese/text';

export interface PinyinGrade {
  correct: boolean;
  /** Every syllable right, at least one tone wrong. */
  toneOnlyError: boolean;
  /** The answer had no tone marks or numbers at all. */
  missingTones: boolean;
  parseErrors: string[];
  comparison: PinyinComparison | null;
}

/** Checks typed pinyin (numbers or marks) against every accepted reading. */
export function gradePinyin(input: string, accepted: readonly string[], ignoreTones = false): PinyinGrade {
  const parsed = parsePinyin(input);
  if (parsed.syllables.length === 0 || parsed.errors.length > 0) {
    return {
      correct: false,
      toneOnlyError: false,
      missingTones: false,
      parseErrors: parsed.errors.length > 0 ? parsed.errors : ['Chưa nhập pinyin.'],
      comparison: null,
    };
  }
  const readings = accepted.map((reading) => parsePinyin(reading).syllables).filter((syllables) => syllables.length > 0);
  const comparison = comparePinyin(readings, parsed.syllables, { ignoreTones });
  const toneOnlyError = !comparison.ok && comparison.segmentErrors.length === 0 && comparison.toneErrors.length > 0;
  return {
    correct: comparison.ok,
    toneOnlyError,
    missingTones: toneOnlyError && !parsed.hasToneInfo,
    parseErrors: [],
    comparison,
  };
}

/** Typed characters match one of the answers, ignoring spaces and punctuation. */
export function gradeHanzi(input: string, answers: readonly string[]): boolean {
  const clean = stripForComparison(input);
  return clean.length > 0 && answers.some((answer) => stripForComparison(answer) === clean);
}

/** Ordered tiles spell the sentence (tiles with the same text are interchangeable). */
export function gradeOrder(tiles: readonly string[], sentence: string): boolean {
  return stripForComparison(tiles.join('')) === stripForComparison(sentence);
}

export function gradeDictation(input: string, sentence: string): { accuracy: number; correct: boolean } {
  const accuracy = charAccuracy(sentence, input);
  return { accuracy, correct: accuracy >= 0.9 };
}

const INITIAL = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/;

/** Hint for pinyin typing: each syllable's initial, e.g. "zhong1 guo2" → "zh… g…". */
export function initialsHint(numbered: string): string {
  return parsePinyin(numbered)
    .syllables.map((syllable) => `${INITIAL.exec(syllable.base)?.[1] ?? syllable.base.slice(0, 1)}…`)
    .join(' ');
}
