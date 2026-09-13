import type { Syllable } from './types';

const MARKED: Record<string, readonly [string, string, string, string]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/**
 * Index of the vowel that carries the tone mark: "a" or "e" if present,
 * the "o" of "ou", otherwise the last vowel (liù, guǐ). -1 when there is none ("r").
 */
export function toneMarkIndex(base: string): number {
  const a = base.indexOf('a');
  if (a !== -1) return a;
  const e = base.indexOf('e');
  if (e !== -1) return e;
  const ou = base.indexOf('ou');
  if (ou !== -1) return ou;
  for (let index = base.length - 1; index >= 0; index--) {
    if ((base[index] ?? '') in MARKED) return index;
  }
  return -1;
}

export function syllableToMarks({ base, tone }: Syllable): string {
  if (tone === 5) return base;
  const index = toneMarkIndex(base);
  const vowel = base[index];
  const marked = vowel === undefined ? undefined : MARKED[vowel]?.[tone - 1];
  return marked === undefined ? base : base.slice(0, index) + marked + base.slice(index + 1);
}

export function toMarks(syllables: readonly Syllable[], separator = ' '): string {
  return syllables.map(syllableToMarks).join(separator);
}

export interface NumberedOptions {
  /** How ü is written: "ü" (default), "v" (typing) or "u:" (CC-CEDICT). */
  ue?: 'ü' | 'v' | 'u:';
  /** Digit for the neutral tone; "" omits it. Default "5". */
  neutral?: '5' | '0' | '';
}

export function syllableToNumbered({ base, tone }: Syllable, options: NumberedOptions = {}): string {
  const written = options.ue && options.ue !== 'ü' ? base.replace(/ü/g, options.ue) : base;
  return written + (tone === 5 ? (options.neutral ?? '5') : String(tone));
}

export function toNumbered(syllables: readonly Syllable[], options: NumberedOptions = {}, separator = ' '): string {
  return syllables.map((syllable) => syllableToNumbered(syllable, options)).join(separator);
}

/** "nǐ hǎo" → "ni hao". */
export function stripToneMarks(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀́̄̌]/g, '')
    .normalize('NFC');
}
