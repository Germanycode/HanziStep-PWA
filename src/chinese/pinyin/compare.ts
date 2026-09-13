import type { Syllable } from './types';

export interface PinyinComparison {
  ok: boolean;
  /** Positions (in the matched reading) where the syllable is right but the tone is wrong. */
  toneErrors: number[];
  /** Positions where the syllable itself is wrong or missing. */
  segmentErrors: number[];
  /** Index of the accepted reading that matched best. */
  matchedIndex: number;
}

function compareOne(expected: readonly Syllable[], actual: readonly Syllable[], ignoreTones: boolean) {
  const toneErrors: number[] = [];
  const segmentErrors: number[] = [];
  if (expected.length !== actual.length) {
    return { toneErrors, segmentErrors: expected.map((_, index) => index) };
  }
  expected.forEach((syllable, index) => {
    const other = actual[index];
    if (!other || other.base !== syllable.base) segmentErrors.push(index);
    else if (!ignoreTones && other.tone !== syllable.tone) toneErrors.push(index);
  });
  return { toneErrors, segmentErrors };
}

/**
 * Compares an answer with every accepted reading (citation tones, sandhi
 * forms, variants) and reports the closest one. With `ignoreTones` (easy mode)
 * only the syllables must match.
 */
export function comparePinyin(
  accepted: readonly (readonly Syllable[])[],
  actual: readonly Syllable[],
  options: { ignoreTones?: boolean } = {},
): PinyinComparison {
  let best: PinyinComparison | undefined;
  accepted.forEach((reading, matchedIndex) => {
    const { toneErrors, segmentErrors } = compareOne(reading, actual, options.ignoreTones ?? false);
    const candidate = { ok: toneErrors.length === 0 && segmentErrors.length === 0, toneErrors, segmentErrors, matchedIndex };
    const errors = (value: PinyinComparison) => value.segmentErrors.length * 2 + value.toneErrors.length;
    if (!best || errors(candidate) < errors(best)) best = candidate;
  });
  return best ?? { ok: false, toneErrors: [], segmentErrors: actual.map((_, index) => index), matchedIndex: -1 };
}
