import { toNumbered } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { applySandhi } from '@/chinese/pinyin/sandhi';
import type { Syllable } from '@/chinese/pinyin/types';
import type { RawToken } from '@/chinese/segment/types';
import type { DictEntry } from '@/domain/types';

/** A token with the reading it has in this sentence. */
export interface ReadToken extends RawToken {
  /** Numbered pinyin, already sandhi-adjusted; empty for punctuation and Latin text. */
  pinyinNum: string;
  /** Dictionary reading before sandhi, shown in the popover when it differs. */
  citation: string;
}

export interface PinyinLookup {
  /** Dictionary entries by headword (simplified and traditional). */
  dict: ReadonlyMap<string, DictEntry[]>;
  /** Readings from the HSK lists, preferred because they are the ones a learner meets. */
  hsk?: ReadonlyMap<string, string>;
}

/**
 * The reading of a whole token, so context decides the pronunciation:
 * 银行 → yin2 hang2 while 行走 → xing2 zou3. Looking characters up one by one
 * would lose that.
 */
export function tokenPinyin(token: string, lookup: PinyinLookup): string | null {
  const preferred = lookup.hsk?.get(token);
  if (preferred) return preferred;
  const entries = lookup.dict.get(token);
  if (!entries || entries.length === 0) return null;
  const exact = entries.find((entry) => entry.s === token) ?? entries[0];
  return exact?.p ?? null;
}

function charCount(text: string): number {
  return [...text].length;
}

/** Applies tone sandhi across neighbouring words, then hands each token its slice back. */
function sandhiRun(tokens: ReadToken[], from: number, to: number): void {
  if (to - from < 1) return;
  const syllables: Syllable[] = [];
  const counts: number[] = [];
  let hanzi = '';
  for (let index = from; index < to; index++) {
    const token = tokens[index];
    if (!token) return;
    const parsed = parsePinyin(token.pinyinNum).syllables;
    // Without one syllable per character the run cannot be aligned, so leave it alone.
    if (parsed.length !== charCount(token.text)) return;
    syllables.push(...parsed);
    counts.push(parsed.length);
    hanzi += token.text;
  }
  if (syllables.length === 0) return;

  const spoken = applySandhi(syllables, hanzi);
  let offset = 0;
  for (let index = from; index < to; index++) {
    const count = counts[index - from] ?? 0;
    const slice = spoken.slice(offset, offset + count);
    offset += count;
    const token = tokens[index];
    if (token && slice.length > 0) token.pinyinNum = toNumbered(slice);
  }
}

/**
 * Gives every token its reading and applies sandhi over each run of adjacent
 * words (punctuation ends a run), as in docs/PLAN.md §7.2 step 3.
 */
export function readSentence(tokens: readonly RawToken[], lookup: PinyinLookup): ReadToken[] {
  const read: ReadToken[] = tokens.map((token) => {
    const citation = token.kind === 'word' ? (tokenPinyin(token.text, lookup) ?? '') : '';
    return { ...token, citation, pinyinNum: citation };
  });

  let runStart = 0;
  for (let index = 0; index <= read.length; index++) {
    const token = read[index];
    if (token && token.kind === 'word' && token.pinyinNum) continue;
    sandhiRun(read, runStart, index);
    runStart = index + 1;
  }
  return read;
}

export type TokenStatus = 'known' | 'learning' | 'target' | 'new' | 'unknown' | 'other';

export interface StatusLookup {
  /** Saved words by characters: the read card's repetition (-1 with no card) and the "already known" flag. */
  saved: ReadonlyMap<string, { repetition: number; known: boolean }>;
  /** Target words of this text. */
  targets: ReadonlySet<string>;
  inDictionary: (word: string) => boolean;
}

/** Token colour in the reader (docs/PLAN.md §7.2 step 4). */
export function tokenStatus(token: RawToken, lookup: StatusLookup): TokenStatus {
  if (token.kind !== 'word') return 'other';
  const saved = lookup.saved.get(token.text);
  if (saved?.known || (saved && saved.repetition >= 3)) return 'known';
  if (saved && saved.repetition >= 0) return 'learning';
  if (lookup.targets.has(token.text)) return 'target';
  return lookup.inDictionary(token.text) ? 'new' : 'unknown';
}

/** Share of content tokens the learner already knows (shown per text). */
export function knownShare(statuses: readonly TokenStatus[]): number {
  const content = statuses.filter((status) => status !== 'other');
  if (content.length === 0) return 1;
  return content.filter((status) => status === 'known').length / content.length;
}
