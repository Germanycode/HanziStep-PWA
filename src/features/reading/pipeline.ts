import { segmentSentence } from '@/chinese/segment/segment';
import { splitSentences } from '@/chinese/segment/sentences';
import { combineLexicons, type Lexicon, type RawToken } from '@/chinese/segment/types';
import { getDictImportState } from '@/data/dictionary';
import { db, type HanziStepDB } from '@/db/db';
import type { Card, DictEntry, TextDoc, Word } from '@/domain/types';
import { knownShare, readSentence, tokenStatus, type PinyinLookup, type ReadToken, type StatusLookup, type TokenStatus } from './tokens';

export interface RenderToken extends ReadToken {
  status: TokenStatus;
}

export interface PreparedSentence {
  index: number;
  zh: string;
  vi?: string;
  tokens: RenderToken[];
}

export interface PreparedText {
  sentences: PreparedSentence[];
  /** The lexicon used, so the popover can offer the same candidate lengths. */
  lexicon: Lexicon;
  /** Share of content tokens already known (recomputed on every open). */
  knownShare: number;
  /** Content words that are not in the dictionary, for the "outside the list" warning. */
  unknownWords: string[];
  targetsFound: string[];
}

let headwords: Promise<Set<string>> | null = null;

/**
 * Every dictionary headword, loaded once per session. The set (about 125k
 * strings) is what makes longest-match segmentation possible without a query
 * per candidate.
 */
export function loadDictionaryHeadwords(database: HanziStepDB = db): Promise<Set<string>> {
  headwords ??= (async () => {
    const [imported, simplified, traditional] = await Promise.all([
      getDictImportState(database),
      database.dict.orderBy('s').uniqueKeys(),
      database.dict.orderBy('t').uniqueKeys(),
    ]);
    const words = new Set<string>();
    for (const key of simplified) if (typeof key === 'string') words.add(key);
    for (const key of traditional) if (typeof key === 'string') words.add(key);
    // Only a finished import may be cached. Half of the dictionary would keep
    // mis-segmenting for the rest of the session, and the reader would never
    // find out that more words had arrived.
    if (!imported || words.size === 0) headwords = null;
    return words;
  })().catch((error: unknown) => {
    headwords = null;
    throw error;
  });
  return headwords;
}

/** Forgets the cached headwords (after a dictionary import). */
export function resetDictionaryHeadwords(): void {
  headwords = null;
}

/** Dictionary entries for the words of one text, in a single query. */
export async function loadEntriesFor(words: readonly string[], database: HanziStepDB = db): Promise<Map<string, DictEntry[]>> {
  const entries = new Map<string, DictEntry[]>();
  if (words.length === 0) return entries;
  const add = (key: string, row: DictEntry) => entries.set(key, [...(entries.get(key) ?? []), row]);

  for (const row of await database.dict.where('s').anyOf([...words]).toArray()) add(row.s, row);
  const missing = words.filter((word) => !entries.has(word));
  if (missing.length > 0) {
    for (const row of await database.dict.where('t').anyOf(missing).toArray()) add(row.t, row);
  }
  return entries;
}

export function buildStatusLookup(
  words: readonly Word[],
  cards: readonly Card[],
  targets: Iterable<string>,
  inDictionary: (word: string) => boolean,
): StatusLookup {
  const readCards = new Map(cards.filter((card) => card.facet === 'read').map((card) => [card.subjectId, card]));
  const saved = new Map<string, { repetition: number; known: boolean }>();
  for (const word of words) {
    const card = readCards.get(word.id);
    const entry = { repetition: card ? card.repetition : -1, known: Boolean(word.knownWithoutSrs) };
    const existing = saved.get(word.simplified);
    // The same characters may be saved twice (多音字): keep the most advanced one.
    if (!existing || entry.known || entry.repetition > existing.repetition) saved.set(word.simplified, entry);
  }
  return { saved, targets: new Set(targets), inDictionary };
}

/** Readings the learner has already saved win over the dictionary's first entry. */
export function savedReadings(words: readonly Word[]): Map<string, string> {
  const readings = new Map<string, string>();
  for (const word of words) if (!readings.has(word.simplified)) readings.set(word.simplified, word.pinyinNum);
  return readings;
}

export function segmentDoc(
  sentences: readonly { zh: string }[],
  overrides: TextDoc['segOverrides'],
  lexicon: Lexicon,
): RawToken[][] {
  return sentences.map((sentence, index) => segmentSentence(sentence.zh, lexicon, overrides[index] ?? []));
}

export function distinctWords(rows: readonly RawToken[][]): string[] {
  const words = new Set<string>();
  for (const tokens of rows) for (const token of tokens) if (token.kind === 'word') words.add(token.text);
  return [...words];
}

export function assemble(
  sentences: readonly { zh: string; vi?: string }[],
  rows: readonly RawToken[][],
  pinyin: PinyinLookup,
  status: StatusLookup,
): PreparedSentence[] {
  return sentences.map((sentence, index) => ({
    index,
    zh: sentence.zh,
    vi: sentence.vi,
    tokens: readSentence(rows[index] ?? [], pinyin).map((token) => ({ ...token, status: tokenStatus(token, status) })),
  }));
}

export interface PrepareOptions {
  words: readonly Word[];
  cards: readonly Card[];
  database?: HanziStepDB;
}

/** Segments a text, reads it and colours every token (docs/PLAN.md §7.2). */
export async function prepareText(doc: Pick<TextDoc, 'sentences' | 'segOverrides' | 'targetWordIds'>, options: PrepareOptions): Promise<PreparedText> {
  const database = options.database ?? db;
  const dictionary = await loadDictionaryHeadwords(database).catch(() => new Set<string>());
  const lexicon = combineLexicons(
    dictionary,
    options.words.map((word) => word.simplified),
  );

  const rows = segmentDoc(doc.sentences, doc.segOverrides, lexicon);
  const words = distinctWords(rows);
  const entries = await loadEntriesFor(words, database);

  const targetWords = options.words.filter((word) => doc.targetWordIds.includes(word.id)).map((word) => word.simplified);
  const status = buildStatusLookup(options.words, options.cards, targetWords, (word) => dictionary.has(word));
  const sentences = assemble(doc.sentences, rows, { dict: entries, hsk: savedReadings(options.words) }, status);

  const statuses = sentences.flatMap((sentence) => sentence.tokens.map((token) => token.status));
  const found = new Set<string>();
  const unknown = new Set<string>();
  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      if (token.status === 'target') found.add(token.text);
      else if (token.status === 'unknown') unknown.add(token.text);
    }
  }
  return { sentences, lexicon, knownShare: knownShare(statuses), unknownWords: [...unknown], targetsFound: [...found] };
}

/** Turns pasted text into the sentence list a TextDoc stores. */
export function sentencesFromText(raw: string): { zh: string }[] {
  return splitSentences(raw.replace(/\r\n?/g, '\n')).map((span) => ({ zh: span.text }));
}
