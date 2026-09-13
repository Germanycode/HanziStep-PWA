import { useLiveQuery } from 'dexie-react-hooks';
import { db, type HanziStepDB } from '@/db/db';
import { recordActivity, type ActivityResult } from '@/progress/recordActivity';
import {
  DRILL_STATS_KEY,
  normalizeDrillStats,
  normalizePinyinProgress,
  PINYIN_PROGRESS_KEY,
  type DrillStats,
  type PinyinProgress,
} from '@/progress/state';
import { applyDrillAnswer } from './drillEngine';

export async function getDrillStats(database: HanziStepDB = db): Promise<DrillStats> {
  return normalizeDrillStats((await database.kv.get(DRILL_STATS_KEY))?.value);
}

export async function saveDrillAnswer(
  key: string,
  correct: boolean,
  isToneQuestion: boolean,
  database: HanziStepDB = db,
  now: number = Date.now(),
): Promise<void> {
  await database.transaction('rw', database.kv, async () => {
    const stats = normalizeDrillStats((await database.kv.get(DRILL_STATS_KEY))?.value);
    await database.kv.put({ key: DRILL_STATS_KEY, value: applyDrillAnswer(stats, key, correct, isToneQuestion, now) });
  });
}

export async function getPinyinProgress(database: HanziStepDB = db): Promise<PinyinProgress> {
  return normalizePinyinProgress((await database.kv.get(PINYIN_PROGRESS_KEY))?.value);
}

/** Marks a lesson done; XP is awarded only the first time. Returns null when it was already completed. */
export async function completeLesson(lessonId: string, database: HanziStepDB = db): Promise<ActivityResult | null> {
  const firstTime = await database.transaction('rw', database.kv, async () => {
    const progress = normalizePinyinProgress((await database.kv.get(PINYIN_PROGRESS_KEY))?.value);
    if (progress.completedLessons.includes(lessonId)) return false;
    await database.kv.put({
      key: PINYIN_PROGRESS_KEY,
      value: { completedLessons: [...progress.completedLessons, lessonId] } satisfies PinyinProgress,
    });
    return true;
  });
  return firstTime ? recordActivity({ kind: 'pinyin-lesson' }, database) : null;
}

export function usePinyinProgress(): PinyinProgress | undefined {
  return useLiveQuery(() => getPinyinProgress(), []);
}

export function useDrillStats(): DrillStats | undefined {
  return useLiveQuery(() => getDrillStats(), []);
}

/** Recent accuracy (1 − mean error rate) over practised items whose key starts with `prefix`. */
export function drillAccuracy(stats: DrillStats | undefined, prefix: string): number | null {
  const items = Object.entries(stats?.items ?? {}).filter(([key, item]) => key.startsWith(prefix) && item.attempts > 0);
  if (items.length === 0) return null;
  return 1 - items.reduce((sum, [, item]) => sum + item.ema, 0) / items.length;
}
