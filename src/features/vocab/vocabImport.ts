import { loadHanvietData } from '@/data/hanvietData';
import { lookupHeadword } from '@/data/dictionary';
import { db, type HanziStepDB } from '@/db/db';
import type { Card, Word } from '@/domain/types';
import { wordKey } from '@/features/review/engine/session';
import { cardId, createCard } from '@/srs/cards';
import type { VocabCsvRow } from './csv';
import { normalizeTags } from './repository';
import { cleanMeanings, wordFromDictEntry } from './wordFactory';

export type ImportMode = 'merge' | 'overwrite';

export interface ImportPlan {
  create: VocabCsvRow[];
  update: { row: VocabCsvRow; word: Word }[];
}

/** Matches CSV rows to saved words by characters + pinyin, or by characters alone when the CSV has none. */
export function planVocabImport(rows: readonly VocabCsvRow[], existing: readonly Word[]): ImportPlan {
  const byKey = new Map(existing.map((word) => [wordKey(word.simplified, word.pinyinNum), word]));
  const bySimplified = new Map<string, Word>();
  for (const word of existing) if (!bySimplified.has(word.simplified)) bySimplified.set(word.simplified, word);

  const plan: ImportPlan = { create: [], update: [] };
  for (const row of rows) {
    const match = row.pinyinNum ? byKey.get(wordKey(row.simplified, row.pinyinNum)) : bySimplified.get(row.simplified);
    if (match) plan.update.push({ row, word: match });
    else plan.create.push(row);
  }
  return plan;
}

function mergeWord(word: Word, row: VocabCsvRow, mode: ImportMode, now: number): Word {
  const overwrite = mode === 'overwrite';
  return {
    ...word,
    traditional: (overwrite ? row.traditional : word.traditional) ?? word.traditional ?? row.traditional,
    hanViet: overwrite && row.hanViet ? row.hanViet : word.hanViet || row.hanViet,
    meaningVi: overwrite && row.meaningVi.length > 0 ? cleanMeanings(row.meaningVi) : cleanMeanings([...word.meaningVi, ...row.meaningVi]),
    meaningEn: overwrite && row.meaningEn.length > 0 ? cleanMeanings(row.meaningEn) : cleanMeanings([...word.meaningEn, ...row.meaningEn]),
    pos: word.pos.length > 0 && !overwrite ? word.pos : row.pos.length > 0 ? row.pos : word.pos,
    classifiers: word.classifiers.length > 0 && !overwrite ? word.classifiers : row.classifiers.length > 0 ? row.classifiers : word.classifiers,
    tags: normalizeTags(overwrite ? row.tags : [...word.tags, ...row.tags]),
    updatedAt: now,
  };
}

async function wordFromRow(row: VocabCsvRow, now: number): Promise<Word> {
  // Fill in what the CSV does not carry from the bundled dictionary.
  const matches = row.pinyinNum && row.meaningVi.length > 0 ? [] : await lookupHeadword(row.simplified).catch((): [] => []);
  const entry = matches.find((item) => !row.pinyinNum || item.p.toLowerCase() === row.pinyinNum.toLowerCase()) ?? matches[0];
  const hanviet = await loadHanvietData().catch(() => null);
  const base = entry
    ? wordFromDictEntry(entry, hanviet, now, 'import')
    : {
        ...wordFromDictEntry(
          { s: row.simplified, t: row.traditional ?? row.simplified, p: row.pinyinNum, pt: '', en: row.meaningEn, vi: row.meaningVi, cl: row.classifiers },
          hanviet,
          now,
          'import',
        ),
      };
  return {
    ...base,
    simplified: row.simplified,
    traditional: row.traditional ?? base.traditional,
    pinyinNum: row.pinyinNum || base.pinyinNum,
    hanViet: row.hanViet || base.hanViet,
    meaningVi: cleanMeanings([...row.meaningVi, ...base.meaningVi]),
    meaningEn: cleanMeanings([...row.meaningEn, ...base.meaningEn]),
    pos: row.pos.length > 0 ? row.pos : base.pos,
    classifiers: row.classifiers.length > 0 ? row.classifiers : base.classifiers,
    hsk:
      row.hskLevel === undefined
        ? base.hsk
        : row.hskTrack === 'hsk2'
          ? { hsk2: row.hskLevel }
          : row.hskTrack === 'hsk3-newest'
            ? { hsk3Newest: row.hskLevel }
            : { hsk3: row.hskLevel },
    tags: normalizeTags(row.tags),
    createdAt: row.createdAt ?? now,
    updatedAt: now,
  };
}

export interface ImportSummary {
  created: number;
  updated: number;
  cards: number;
}

/**
 * Applies an import. Rows that carry a schedule keep it (restoring a list);
 * the rest are saved without cards, so they appear in "Học mới" first.
 */
export async function applyVocabImport(
  plan: ImportPlan,
  mode: ImportMode,
  database: HanziStepDB = db,
  now = Date.now(),
): Promise<ImportSummary> {
  const created: Word[] = [];
  const cards: Card[] = [];
  for (const row of plan.create) {
    const word = await wordFromRow(row, now);
    created.push(word);
    if (row.schedule) {
      cards.push({
        ...createCard(word.id, 'read', now),
        id: cardId('read', word.id),
        state: row.schedule.intervalDays >= 1 ? 'review' : 'learning',
        repetition: row.schedule.repetition,
        easeFactor: row.schedule.easeFactor,
        intervalDays: row.schedule.intervalDays,
        lapses: row.schedule.lapses,
        due: row.schedule.due,
      });
    }
  }
  const updated = plan.update.map(({ row, word }) => mergeWord(word, row, mode, now));
  for (const { row, word } of plan.update) {
    if (!row.schedule) continue;
    cards.push({
      ...createCard(word.id, 'read', now),
      id: cardId('read', word.id),
      state: row.schedule.intervalDays >= 1 ? 'review' : 'learning',
      repetition: row.schedule.repetition,
      easeFactor: row.schedule.easeFactor,
      intervalDays: row.schedule.intervalDays,
      lapses: row.schedule.lapses,
      due: row.schedule.due,
    });
  }

  await database.transaction('rw', [database.words, database.cards], async () => {
    if (created.length > 0) await database.words.bulkAdd(created);
    if (updated.length > 0) await database.words.bulkPut(updated);
    if (cards.length > 0) await database.cards.bulkPut(cards);
  });
  return { created: created.length, updated: updated.length, cards: cards.length };
}
