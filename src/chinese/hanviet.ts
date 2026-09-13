/**
 * Hán-Việt readings. Data keys are TRADITIONAL characters (source:
 * ph0ngp/hanviet-pinyin-words) mapped by numbered pinyin, with ü written as
 * "u:"; "*" means the character always has these readings.
 *
 * Shared with the Node build scripts: no "@/" imports here.
 */
export type HanvietData = Record<string, Record<string, string[]>>;

export interface HanvietOptions {
  /** Readings used when `data` has nothing for a character (e.g. Unihan kVietnamese). */
  fallback?: HanvietData;
  /** Vietnamese text such as the word's meanings, used to choose between readings (银行 "ngân hàng" → HÀNG). */
  context?: string;
  /** Usual full tone of a character written with a neutral tone (上 + "shang" → 4). */
  neutralToneHint?: (char: string, tonelessSyllable: string) => number | undefined;
}

export interface HanvietReading {
  /** One reading per character, e.g. "NGÂN HÀNG". */
  best: string;
  /** Every candidate, e.g. "NGÂN HÀNG/HẠNG"; equal to `best` when nothing is ambiguous. */
  all: string;
}

const HAN_RE = /\p{Script=Han}/u;
const LETTER_RE = /\p{L}/u;
const SYLLABLE_RE = /^[a-zü:]+[1-5]$/i;

export function isHanChar(char: string): boolean {
  return HAN_RE.test(char);
}

export function hanvietPinyinKey(syllable: string): string {
  return syllable.toLowerCase().replace(/ü/g, 'u:').replace(/v/g, 'u:');
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

/**
 * Readings of one character for a pinyin syllable. A neutral tone uses the
 * hinted full tone (or all full tones); an unmatched pinyin falls back to
 * every reading of the character so the learner still sees the candidates.
 */
export function readingsFor(
  data: HanvietData,
  char: string,
  syllable?: string,
  neutralToneHint?: HanvietOptions['neutralToneHint'],
): string[] {
  const entry = data[char];
  if (!entry) return [];
  const always = entry['*'];
  if (always && always.length > 0) return always;

  if (syllable) {
    const key = hanvietPinyinKey(syllable);
    const exact = entry[key];
    if (exact && exact.length > 0) return exact;
    if (key.endsWith('5')) {
      const base = key.slice(0, -1);
      const hinted = neutralToneHint?.(char, base);
      const hintedReadings = hinted === undefined ? undefined : entry[base + hinted];
      if (hintedReadings && hintedReadings.length > 0) return hintedReadings;
      const merged = unique(['1', '2', '3', '4'].flatMap((tone) => entry[base + tone] ?? []));
      if (merged.length > 0) return merged;
    }
  }
  return unique(Object.values(entry).flat());
}

function normalizeVietnamese(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('vi');
}

/** True when `word` appears in `haystack` with no letters directly around it. */
function containsWord(haystack: string, word: string): boolean {
  for (let index = haystack.indexOf(word); index !== -1; index = haystack.indexOf(word, index + 1)) {
    const before = haystack[index - 1];
    const after = haystack[index + word.length];
    if (!(before && LETTER_RE.test(before)) && !(after && LETTER_RE.test(after))) return true;
  }
  return false;
}

/**
 * Hán-Việt for a word written in traditional characters, e.g.
 * ("銀行", "yin2 hang2", { context: "ngân hàng" }) → { best: "NGÂN HÀNG", all: "NGÂN HÀNG/HẠNG" }.
 * Unknown characters show "?"; non-Han characters are kept as they are.
 */
export function hanvietReading(
  data: HanvietData,
  traditional: string,
  pinyinNum: string,
  options: HanvietOptions = {},
): HanvietReading {
  const chars = [...traditional];
  const hanCount = chars.filter(isHanChar).length;
  const syllables = pinyinNum
    .trim()
    .split(/\s+/)
    .filter((part) => SYLLABLE_RE.test(part));
  const aligned = syllables.length === hanCount;
  const haystack = options.context ? normalizeVietnamese(options.context) : '';

  const best: string[] = [];
  const all: string[] = [];
  let hanIndex = 0;
  for (const char of chars) {
    if (!isHanChar(char)) {
      if (char.trim()) {
        best.push(char);
        all.push(char);
      }
      continue;
    }
    const syllable = aligned ? syllables[hanIndex] : undefined;
    hanIndex++;
    let readings = readingsFor(data, char, syllable, options.neutralToneHint);
    if (readings.length === 0 && options.fallback) readings = readingsFor(options.fallback, char);
    const first = readings[0];
    if (first === undefined) {
      best.push('?');
      all.push('?');
      continue;
    }
    const inContext = haystack ? readings.find((reading) => containsWord(haystack, normalizeVietnamese(reading))) : undefined;
    best.push((inContext ?? first).toLocaleUpperCase('vi'));
    all.push(readings.join('/').toLocaleUpperCase('vi'));
  }
  return { best: best.join(' '), all: all.join(' ') };
}

/** The best single reading per character; see `hanvietReading`. */
export function hanvietForWord(
  data: HanvietData,
  traditional: string,
  pinyinNum: string,
  options: HanvietOptions = {},
): string {
  return hanvietReading(data, traditional, pinyinNum, options).best;
}
