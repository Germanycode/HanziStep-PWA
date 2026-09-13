/** Word segmentation shared by the reader, the popover and the story checker. */

export type TokenKind = 'word' | 'punct' | 'num' | 'latin' | 'space';

export interface RawToken {
  text: string;
  /** Code-unit offsets inside the sentence (the same units Intl.Segmenter reports). */
  start: number;
  end: number;
  kind: TokenKind;
}

/** Words the segmenter may join: the dictionary, the HSK lists and saved words. */
export interface Lexicon {
  has(word: string): boolean;
}

export function createLexicon(...sources: readonly Iterable<string>[]): Lexicon {
  const words = new Set<string>();
  for (const source of sources) for (const word of source) if (word) words.add(word);
  return { has: (word) => words.has(word) };
}

/** Adds a few words to a large set without copying it (the dictionary has 125k headwords). */
export function combineLexicons(base: ReadonlySet<string>, extra: Iterable<string>): Lexicon {
  const extras = new Set(extra);
  return { has: (word) => base.has(word) || extras.has(word) };
}

export const EMPTY_LEXICON: Lexicon = { has: () => false };
