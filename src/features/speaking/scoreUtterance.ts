import { parsePinyin } from '@/chinese/pinyin/parse';

/** How one syllable of the target came out (docs/PLAN.md §8.4). */
export type SyllableMark = 'match' | 'homophone' | 'wrong' | 'missing';

export interface UtteranceScore {
  /** The alternative that matched best, or '' when nothing was heard. */
  best: string;
  /** The characters are exactly the target's. */
  charMatch: boolean;
  /** The syllables match when tones are ignored — the recogniser cannot hear tones. */
  tonelessSyllableMatch: boolean;
  perSyllable: SyllableMark[];
  /** Never 5: a speech recogniser cannot confirm tones (docs/PLAN.md §8.4). */
  quality: 0 | 1 | 3 | 4;
}

export interface ScoreOptions {
  /** Numbered pinyin for a piece of text; used to compare what was heard. */
  readingOf?: (text: string) => string;
  /** Traditional → simplified, when a mapping is available. */
  toSimplified?: (char: string) => string;
  /** 1 or 2; a second try can never score better than 3. */
  attempt?: number;
}

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const KEEP = /[\p{Script=Han}\p{L}\p{N}]/u;

/** Drops punctuation and spaces, writes digits as characters, and folds to simplified. */
export function normalizeTranscript(text: string, toSimplified?: (char: string) => string): string {
  return [...text.normalize('NFC')]
    .filter((char) => KEEP.test(char))
    .map((char) => {
      const digit = '0123456789'.indexOf(char);
      const wide = '０１２３４５６７８９'.indexOf(char);
      const index = digit >= 0 ? digit : wide;
      if (index >= 0) return DIGITS[index] ?? char;
      return toSimplified ? toSimplified(char) : char;
    })
    .join('');
}

function tonelessSyllables(pinyinNum: string): string[] {
  return parsePinyin(pinyinNum).syllables.map((syllable) => syllable.base);
}

function editDistance(a: readonly string[], b: readonly string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i, ...new Array<number>(b.length).fill(0)];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((current[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function marksFor(targetChars: readonly string[], targetSyllables: readonly string[], heardChars: readonly string[], heardSyllables: readonly string[]): SyllableMark[] {
  return targetChars.map((char, index) => {
    const heardChar = heardChars[index];
    if (heardChar === undefined) return 'missing';
    if (heardChar === char) return 'match';
    const target = targetSyllables[index];
    const heard = heardSyllables[index];
    return target && heard && target === heard ? 'homophone' : 'wrong';
  });
}

/**
 * Compares what the recogniser heard with the target. Matching characters is
 * the only strong signal; syllables that match without the characters are
 * reported as homophones, and tones are never judged here.
 */
export function scoreUtterance(
  target: { hanzi: string; pinyinNum: string },
  alternatives: readonly string[],
  options: ScoreOptions = {},
): UtteranceScore {
  const attempt = options.attempt ?? 1;
  const targetHanzi = normalizeTranscript(target.hanzi, options.toSimplified);
  const targetChars = [...targetHanzi];
  const targetSyllables = tonelessSyllables(target.pinyinNum);
  const heardList = alternatives.map((alternative) => normalizeTranscript(alternative, options.toSimplified)).filter(Boolean);

  if (heardList.length === 0) {
    return {
      best: '',
      charMatch: false,
      tonelessSyllableMatch: false,
      perSyllable: targetChars.map(() => 'missing'),
      quality: attempt >= 2 ? 1 : 0,
    };
  }

  const exact = heardList.find((heard) => heard === targetHanzi);
  if (exact !== undefined) {
    return {
      best: exact,
      charMatch: true,
      tonelessSyllableMatch: true,
      perSyllable: targetChars.map(() => 'match'),
      quality: attempt >= 2 ? 3 : 4,
    };
  }

  const readingOf = options.readingOf ?? (() => '');
  const scored = heardList.map((heard) => {
    const syllables = tonelessSyllables(readingOf(heard));
    return { heard, syllables, distance: editDistance(targetSyllables, syllables) };
  });
  scored.sort((a, b) => a.distance - b.distance);
  const best = scored[0];
  if (!best) {
    return { best: '', charMatch: false, tonelessSyllableMatch: false, perSyllable: targetChars.map(() => 'missing'), quality: attempt >= 2 ? 1 : 0 };
  }

  const sameSyllables =
    best.syllables.length === targetSyllables.length && best.syllables.every((syllable, index) => syllable === targetSyllables[index]);
  const perSyllable = marksFor(targetChars, targetSyllables, [...best.heard], best.syllables);

  return {
    best: best.heard,
    charMatch: false,
    tonelessSyllableMatch: sameSyllables,
    perSyllable,
    quality: sameSyllables ? 3 : attempt >= 2 ? 1 : 0,
  };
}
