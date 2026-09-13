import { loadHskLevel } from '@/data/hsk';
import type { HskTrackKey, HskWordRecord } from '@/data/types';
import { db, type HanziStepDB } from '@/db/db';
import type { Word } from '@/domain/types';
import { wordKey } from '@/features/review/engine/session';
import { wordFromHskRecord } from './wordFactory';

/**
 * "I already know this whole level" (docs/PLAN.md §9, Phase 5): a learner who
 * comes in at HSK 3 should not have to introduce a thousand words one by one.
 */

export const LAST_PLACEMENT_KEY = 'lastPlacement';

export interface PlacementPlan {
  /** Records that would become new "already known" words. */
  toAdd: HskWordRecord[];
  /** Words of this level already in the collection, left untouched. */
  skipped: number;
  total: number;
}

export function planPlacement(records: readonly HskWordRecord[], existingKeys: ReadonlySet<string>): PlacementPlan {
  const toAdd: HskWordRecord[] = [];
  let skipped = 0;
  const seen = new Set(existingKeys);
  for (const record of records) {
    const form = record.f[0];
    if (!form) continue;
    const key = wordKey(record.s, form.pn);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toAdd.push(record);
  }
  return { toAdd, skipped, total: records.length };
}

async function existingKeys(database: HanziStepDB): Promise<Set<string>> {
  const words = await database.words.toArray();
  return new Set(words.map((word) => wordKey(word.simplified, word.pinyinNum)));
}

export interface PlacementPreview {
  level: number;
  total: number;
  newWords: number;
  alreadyHave: number;
}

export async function previewPlacement(track: HskTrackKey, level: number, database: HanziStepDB = db): Promise<PlacementPreview> {
  const file = await loadHskLevel(track, level);
  const plan = planPlacement(file.words, await existingKeys(database));
  return { level, total: plan.total, newWords: plan.toAdd.length, alreadyHave: plan.skipped };
}

export interface PlacementResult {
  added: number;
  skipped: number;
}

/** Adds the level's words as "already known": stored, but never scheduled. */
export async function markLevelKnown(track: HskTrackKey, level: number, database: HanziStepDB = db): Promise<PlacementResult> {
  const file = await loadHskLevel(track, level);
  const now = Date.now();
  const plan = planPlacement(file.words, await existingKeys(database));
  const words: Word[] = plan.toAdd.map((record) => ({ ...wordFromHskRecord(record, now), knownWithoutSrs: true }));

  await database.transaction('rw', [database.words, database.kv], async () => {
    if (words.length > 0) await database.words.bulkAdd(words);
    await database.kv.put({
      key: LAST_PLACEMENT_KEY,
      value: { track, level, at: now, ids: words.map((word) => word.id) },
    });
  });
  return { added: words.length, skipped: plan.skipped };
}

export interface LastPlacement {
  track: HskTrackKey;
  level: number;
  at: number;
  ids: string[];
}

export async function getLastPlacement(database: HanziStepDB = db): Promise<LastPlacement | null> {
  const value = (await database.kv.get(LAST_PLACEMENT_KEY))?.value as Partial<LastPlacement> | undefined;
  if (!value || !Array.isArray(value.ids) || typeof value.level !== 'number') return null;
  return { track: (value.track ?? 'hsk3') as HskTrackKey, level: value.level, at: value.at ?? 0, ids: value.ids };
}

/** Removes exactly the words the last placement added. */
export async function undoLastPlacement(database: HanziStepDB = db): Promise<number> {
  const last = await getLastPlacement(database);
  if (!last || last.ids.length === 0) return 0;
  await database.transaction('rw', [database.words, database.cards, database.kv], async () => {
    await database.cards.where('subjectId').anyOf(last.ids).delete();
    await database.words.bulkDelete(last.ids);
    await database.kv.delete(LAST_PLACEMENT_KEY);
  });
  return last.ids.length;
}
