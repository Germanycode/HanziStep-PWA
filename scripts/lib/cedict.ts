/** Parser for CC-CEDICT-format files (also used by CVDICT). */

export interface CedictEntry {
  trad: string;
  simp: string;
  /** numbered pinyin as written in the file, e.g. "yin2 hang2" or "nu:3" */
  pinyin: string;
  glosses: string[];
}

const LINE_RE = /^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/;

export function parseCedictLine(line: string): CedictEntry | null {
  if (!line || line.startsWith('#')) return null;
  const match = LINE_RE.exec(line);
  if (!match) return null;
  const [, trad, simp, pinyin, body] = match;
  if (!trad || !simp || pinyin === undefined || body === undefined) return null;
  return {
    trad,
    simp,
    pinyin: pinyin.trim(),
    glosses: body
      .split('/')
      .map((gloss) => gloss.trim())
      .filter(Boolean),
  };
}

export function parseCedict(text: string): CedictEntry[] {
  const entries: CedictEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const entry = parseCedictLine(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

/** CC-CEDICT writes "CL:"; CVDICT translates it to "LT:" (lượng từ). */
const CLASSIFIER_PREFIX = /^(?:CL|LT):\s*/;

/** Moves "CL:個|个[ge4],位[wei4]" glosses into a list of simplified classifiers. */
export function extractClassifiers(glosses: readonly string[]): { glosses: string[]; classifiers: string[] } {
  const kept: string[] = [];
  const classifiers: string[] = [];
  for (const gloss of glosses) {
    const prefix = CLASSIFIER_PREFIX.exec(gloss);
    if (!prefix) {
      kept.push(gloss);
      continue;
    }
    for (const part of gloss.slice(prefix[0].length).split(',')) {
      const match = /^([^|[\]]+)(?:\|([^[\]]+))?\[/.exec(part.trim());
      const simplified = match ? (match[2] ?? match[1]) : undefined;
      if (simplified && !classifiers.includes(simplified)) classifiers.push(simplified);
    }
  }
  return { glosses: kept, classifiers };
}
