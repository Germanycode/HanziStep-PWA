import { tonelessKey } from '@/chinese/pinyin/keys';
import { levelOf } from '@/data/hsk';
import type { HskTrackKey } from '@/data/types';
import type { Card, Word } from '@/domain/types';

export type MasteryFilter = 'all' | 'pending' | 'learning' | 'review' | 'mastered' | 'known';
export type VocabSort = 'recent' | 'alpha' | 'due' | 'mastery' | 'hsk';

export interface VocabRow {
  word: Word;
  read?: Card;
  listen?: Card;
  /** Read-card repetition; -1 when the word has no cards yet. */
  mastery: number;
  dueAt?: number;
  level?: number;
}

export interface VocabFilters {
  query: string;
  tag: string;
  /** '', '1'…'7', or 'none' for words outside the current HSK track. */
  level: string;
  mastery: MasteryFilter;
  sort: VocabSort;
}

export const DEFAULT_VOCAB_FILTERS: VocabFilters = { query: '', tag: '', level: '', mastery: 'all', sort: 'recent' };

/** Lowercase, without Vietnamese diacritics, so "ngan hang" finds "ngân hàng". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function buildVocabRows(words: readonly Word[], cards: readonly Card[], track: HskTrackKey): VocabRow[] {
  const byWord = new Map<string, { read?: Card; listen?: Card }>();
  for (const card of cards) {
    const entry = byWord.get(card.subjectId) ?? {};
    if (card.facet === 'read') entry.read = card;
    else if (card.facet === 'listen') entry.listen = card;
    byWord.set(card.subjectId, entry);
  }
  return words.map((word) => {
    const entry = byWord.get(word.id);
    return {
      word,
      read: entry?.read,
      listen: entry?.listen,
      mastery: entry?.read ? entry.read.repetition : -1,
      dueAt: entry?.read?.due,
      level: levelOf(word.hsk, track),
    };
  });
}

function matchesQuery(row: VocabRow, query: string): boolean {
  const needle = normalizeSearch(query.trim());
  if (!needle) return true;
  const { word } = row;
  if (word.simplified.includes(query.trim()) || (word.traditional?.includes(query.trim()) ?? false)) return true;
  const haystacks = [
    normalizeSearch(word.pinyinNum),
    tonelessKey(word.pinyinNum),
    normalizeSearch(word.hanViet),
    ...word.meaningVi.map(normalizeSearch),
    ...word.meaningEn.map(normalizeSearch),
    ...word.tags.map(normalizeSearch),
  ];
  return haystacks.some((value) => value.includes(needle)) || tonelessKey(word.pinyinNum).includes(needle.replace(/\s+/g, ''));
}

function matchesMastery(row: VocabRow, filter: MasteryFilter): boolean {
  switch (filter) {
    case 'known':
      return Boolean(row.word.knownWithoutSrs);
    case 'pending':
      return !row.word.knownWithoutSrs && row.mastery < 0;
    case 'learning':
      return row.mastery >= 0 && row.mastery <= 1;
    case 'review':
      return row.mastery >= 2 && row.mastery <= 3;
    case 'mastered':
      return row.mastery >= 4;
    default:
      return true;
  }
}

const SORTS: Record<VocabSort, (a: VocabRow, b: VocabRow) => number> = {
  recent: (a, b) => b.word.createdAt - a.word.createdAt,
  alpha: (a, b) => a.word.pinyinNum.localeCompare(b.word.pinyinNum),
  due: (a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER),
  mastery: (a, b) => a.mastery - b.mastery || b.word.createdAt - a.word.createdAt,
  hsk: (a, b) => (a.level ?? 99) - (b.level ?? 99) || (a.word.freqRank ?? 1e9) - (b.word.freqRank ?? 1e9),
};

export function filterVocabRows(rows: readonly VocabRow[], filters: VocabFilters): VocabRow[] {
  const result = rows.filter((row) => {
    if (!matchesQuery(row, filters.query)) return false;
    if (filters.tag && !row.word.tags.includes(filters.tag)) return false;
    if (filters.level === 'none' && row.level !== undefined) return false;
    if (filters.level && filters.level !== 'none' && String(row.level ?? '') !== filters.level) return false;
    return matchesMastery(row, filters.mastery);
  });
  return result.sort(SORTS[filters.sort]);
}

export function vocabTags(words: readonly Word[]): string[] {
  return [...new Set(words.flatMap((word) => word.tags))].sort((a, b) => a.localeCompare(b, 'vi'));
}

export interface VocabCounts {
  total: number;
  pending: number;
  learning: number;
  review: number;
  mastered: number;
  known: number;
}

export function countVocab(rows: readonly VocabRow[]): VocabCounts {
  const counts: VocabCounts = { total: rows.length, pending: 0, learning: 0, review: 0, mastered: 0, known: 0 };
  for (const row of rows) {
    if (row.word.knownWithoutSrs) counts.known++;
    else if (row.mastery < 0) counts.pending++;
    else if (row.mastery <= 1) counts.learning++;
    else if (row.mastery <= 3) counts.review++;
    else counts.mastered++;
  }
  return counts;
}
