const HAN_RE = /\p{Script=Han}/u;

export function hanChars(text: string): string[] {
  return [...text].filter((char) => HAN_RE.test(char));
}

/**
 * Smallest HSK level L (1..maxLevel) at which at least `ratio` of the Han
 * tokens are known (token level ≤ L). Unknown tokens are `null`. Returns null
 * when the sentence never reaches the ratio.
 */
export function sentenceLevel(tokenLevels: readonly (number | null)[], maxLevel = 6, ratio = 0.9): number | null {
  if (tokenLevels.length === 0) return null;
  for (let level = 1; level <= maxLevel; level++) {
    const known = tokenLevels.filter((value) => value !== null && value <= level).length;
    if (known / tokenLevels.length >= ratio) return level;
  }
  return null;
}

export interface ManythingsPair {
  en: string;
  zh: string;
  ids: number[];
}

/** manythings.org Anki line: "English\tChinese\tCC-BY 2.0 (France) Attribution: tatoeba.org #1 (a) & #2 (b)". */
export function parseManythingsLine(line: string): ManythingsPair | null {
  const [en, zh, attribution = ''] = line.split('\t');
  if (!en?.trim() || !zh?.trim()) return null;
  const ids = [...attribution.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
  return { en: en.trim(), zh: zh.trim(), ids };
}
