import type { Lexicon, RawToken, TokenKind } from './types';

const HAN = /\p{Script=Han}/u;
const HAN_ONLY = /^\p{Script=Han}+$/u;
const DIGIT = /[\p{Nd}]/u;
const LATIN = /\p{Script=Latin}/u;

/** Longest word the segmenter will join (docs/PLAN.md §7.3). */
export const MAX_WORD_LENGTH = 8;

let segmenter: Intl.Segmenter | null = null;
function getSegmenter(): Intl.Segmenter {
  segmenter ??= new Intl.Segmenter('zh', { granularity: 'word' });
  return segmenter;
}

export function classifyToken(text: string): TokenKind {
  const first = text[0] ?? '';
  if (!first.trim()) return 'space';
  if (HAN.test(first)) return 'word';
  if (DIGIT.test(first)) return 'num';
  if (LATIN.test(first)) return 'latin';
  return 'punct';
}

/**
 * Every word in the lexicon that starts at `index`, longest first, plus the
 * single character. 中国人 gives 中国人 / 中国 / 中 (docs/PLAN.md §7.3).
 */
export function longestMatchAt(text: string, index: number, lexicon: Lexicon, maxLength = MAX_WORD_LENGTH): string[] {
  const max = Math.min(maxLength, text.length - index);
  const results: string[] = [];
  for (let length = max; length >= 1; length--) {
    const candidate = text.slice(index, index + length);
    if (!HAN_ONLY.test(candidate)) continue;
    if (length === 1 || lexicon.has(candidate)) results.push(candidate);
  }
  return results;
}

/** The longest known word starting at `index`, or null when even the character is unknown. */
export function longestWordAt(text: string, index: number, lexicon: Lexicon, maxLength = MAX_WORD_LENGTH): string | null {
  const max = Math.min(maxLength, text.length - index);
  for (let length = max; length >= 2; length--) {
    const candidate = text.slice(index, index + length);
    if (HAN_ONLY.test(candidate) && lexicon.has(candidate)) return candidate;
  }
  const single = text.slice(index, index + 1);
  return lexicon.has(single) ? single : null;
}

function nextForcedStart(starts: readonly number[], index: number): number | undefined {
  return starts.find((start) => start > index);
}

/**
 * Splits one sentence into tokens (docs/PLAN.md §7.2):
 * 1. dictionary words win, longest first, so 银行 stays together and 行走 is not cut;
 * 2. runs with no dictionary word fall back to Intl.Segmenter, which keeps names together;
 * 3. `forced` spans from the text's own overrides always become single tokens,
 *    which is how both "split" and "merge" are stored.
 */
export function segmentSentence(
  text: string,
  lexicon: Lexicon,
  forced: readonly (readonly [number, number])[] = [],
): RawToken[] {
  const forcedSpans = new Map<number, number>();
  for (const [start, end] of forced) {
    if (start >= 0 && end > start && start < text.length) forcedSpans.set(start, Math.min(end, text.length));
  }
  const forcedStarts = [...forcedSpans.keys()].sort((a, b) => a - b);

  const pieces = new Map<number, string>();
  for (const piece of getSegmenter().segment(text)) pieces.set(piece.index, piece.segment);

  const tokens: RawToken[] = [];
  const push = (start: number, end: number) => {
    const value = text.slice(start, end);
    tokens.push({ text: value, start, end, kind: classifyToken(value) });
  };

  let index = 0;
  while (index < text.length) {
    const forcedEnd = forcedSpans.get(index);
    if (forcedEnd !== undefined) {
      push(index, forcedEnd);
      index = forcedEnd;
      continue;
    }
    // A token may never swallow the start of a forced span.
    const limit = nextForcedStart(forcedStarts, index) ?? text.length;
    const char = text[index] ?? '';

    if (HAN.test(char)) {
      const word = longestWordAt(text, index, lexicon, Math.min(MAX_WORD_LENGTH, limit - index));
      if (word && word.length > 1) {
        push(index, index + word.length);
        index += word.length;
        continue;
      }
      const piece = pieces.get(index);
      const usable = piece && piece.length > 1 && HAN_ONLY.test(piece) && !word ? Math.min(piece.length, limit - index) : 1;
      push(index, index + usable);
      index += usable;
      continue;
    }

    const piece = pieces.get(index) ?? char;
    const length = Math.max(1, Math.min(piece.length, limit - index));
    push(index, index + length);
    index += length;
  }
  return tokens;
}
