/** 5 = neutral tone (also written 0, or without a mark). */
export type PinyinTone = 1 | 2 | 3 | 4 | 5;

export interface Syllable {
  /** Toneless syllable in lower case with ü, e.g. "lü", "zhuang", "r". */
  base: string;
  tone: PinyinTone;
}
