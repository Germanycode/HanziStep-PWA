/** Sentence helpers: word segmentation, ordering tiles and character accuracy. */

const HAN_LETTER_DIGIT = /[\p{Script=Han}\p{L}\p{N}]/u;

let segmenter: Intl.Segmenter | null = null;
function getSegmenter(): Intl.Segmenter {
  segmenter ??= new Intl.Segmenter('zh', { granularity: 'word' });
  return segmenter;
}

export interface TextSegment {
  text: string;
  isWord: boolean;
}

export function segmentWords(text: string): TextSegment[] {
  return [...getSegmenter().segment(text)].map((segment) => ({ text: segment.segment, isWord: Boolean(segment.isWordLike) }));
}

/** Tiles for sentence ordering: word segments, with punctuation attached to the tile before it. */
export function sentenceTiles(sentence: string): string[] {
  const tiles: string[] = [];
  for (const { text, isWord } of segmentWords(sentence)) {
    if (!text.trim()) continue;
    const last = tiles.length - 1;
    if (isWord || last < 0) tiles.push(text);
    else tiles[last] += text;
  }
  return tiles;
}

/** True when `word` is one of the sentence's segmented words (not just a substring of a longer word). */
export function containsWordToken(sentence: string, word: string): boolean {
  return segmentWords(sentence).some((segment) => segment.text === word);
}

/** Keeps Han characters, letters and digits (drops punctuation and spaces) for answer comparison. */
export function stripForComparison(text: string): string {
  return [...text.normalize('NFC')]
    .filter((char) => HAN_LETTER_DIGIT.test(char))
    .join('')
    .toLowerCase();
}

/** Longest common subsequence length, by code point. */
export function lcsLength(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  let previous = new Array<number>(right.length + 1).fill(0);
  for (const leftChar of left) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j++) {
      current[j] = leftChar === right[j - 1] ? (previous[j - 1] ?? 0) + 1 : Math.max(previous[j] ?? 0, current[j - 1] ?? 0);
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

/** Share of matching characters, penalising both missing and extra characters (0–1). */
export function charAccuracy(expected: string, actual: string): number {
  const cleanExpected = stripForComparison(expected);
  const cleanActual = stripForComparison(actual);
  const longest = Math.max([...cleanExpected].length, [...cleanActual].length);
  if (longest === 0) return 1;
  return lcsLength(cleanExpected, cleanActual) / longest;
}
