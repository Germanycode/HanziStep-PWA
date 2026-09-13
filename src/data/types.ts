/**
 * Shapes of the generated data files in public/data/v1. Shared by the app and
 * the Node build scripts, so this file must not use "@/" imports.
 */

export type HskTrackKey = 'hsk2' | 'hsk3' | 'hsk3-newest';

export interface HskWordForm {
  /** traditional */
  t: string;
  /** pinyin with tone marks */
  py: string;
  /** numbered pinyin */
  pn: string;
  en: string[];
  vi: string[];
  /** classifiers (measure words) */
  cl: string[];
  /** Best Hán-Việt reading, e.g. "NGÂN HÀNG" */
  hv: string;
  /** Every candidate when some character is ambiguous, e.g. "NGÂN HÀNG/HẠNG" */
  hva?: string;
}

export interface HskWordRecord {
  /** simplified */
  s: string;
  /** radical */
  r?: string;
  /** frequency rank (lower = more common) */
  q: number;
  pos: string[];
  lv: { hsk2?: number; hsk3?: number; hsk3Newest?: number };
  f: HskWordForm[];
}

export interface HskLevelFile {
  track: HskTrackKey;
  /** 7 means band 7–9 on the HSK 3.0 tracks */
  level: number;
  words: HskWordRecord[];
}

/** Compact dictionary row: [simplified, traditional, numbered pinyin, en[], vi[], classifiers[]]. */
export type DictRow = [string, string, string, string[], string[], string[]];

export interface SyllableInfo {
  /** toneless syllable, ü written as "v" (e.g. "lv") */
  key: string;
  /** display form with ü (e.g. "lü") */
  display: string;
  initial: string;
  final: string;
  /** tones that have a recording in audio/syllables/{key}{tone}.mp3 */
  tones: number[];
}

export interface SentenceRecord {
  zh: string;
  en: string;
  /** Tatoeba sentence ids (attribution) */
  ids: number[];
}
