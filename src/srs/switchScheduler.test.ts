import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import { getSettings, updateSettings } from '@/db/settings';
import type { Card, ReviewLog } from '@/domain/types';
import { DAY_MS } from './scheduler';
import { switchScheduler } from './switchScheduler';

const opened: HanziStepDB[] = [];
const START = Date.UTC(2026, 0, 1, 8);

function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`switch-scheduler-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

describe('switchScheduler', () => {
  it('replays the target atomically and restores the previous schedule on return', async () => {
    const database = freshDb();
    await updateSettings({ scheduler: 'sm2' }, database);
    const original: Card = {
      id: 'read:w1',
      subjectType: 'word',
      subjectId: 'w1',
      facet: 'read',
      state: 'review',
      repetition: 2,
      easeFactor: 2.5,
      intervalDays: 7,
      due: START + 9 * DAY_MS,
      lapses: 0,
      lastReviewedAt: START + 2 * DAY_MS,
    };
    await database.cards.put(original);
    const baseLog: ReviewLog = {
      cardId: original.id,
      subjectId: original.subjectId,
      facet: 'read',
      questionType: 'mcq-hanzi-vi',
      mode: 'review',
      correct: true,
      quality: 4,
      rating: 3,
      elapsedMs: 1000,
      hints: 0,
      replays: 0,
      reviewedAt: START,
      dayKey: '2026-01-01',
      before: { repetition: 0, easeFactor: 2.5, intervalDays: 0, due: START },
      after: { repetition: 1, easeFactor: 2.5, intervalDays: 1 / 72, due: START + DAY_MS / 72 },
    };
    await database.reviewLogs.bulkAdd([
      baseLog,
      { ...baseLog, reviewedAt: START + 2 * DAY_MS, before: baseLog.after, after: { ...baseLog.after, repetition: 2, intervalDays: 1 } },
    ]);

    const toFsrs = await switchScheduler('fsrs', database);
    expect(toFsrs.replayed).toBe(1);
    expect((await getSettings(database)).scheduler).toBe('fsrs');
    const fsrsCard = await database.cards.get(original.id);
    expect(fsrsCard?.fsrs?.stability).toBeGreaterThan(0);
    expect(fsrsCard?.schedulerStates?.sm2?.due).toBe(original.due);

    await switchScheduler('sm2', database);
    const restored = await database.cards.get(original.id);
    expect((await getSettings(database)).scheduler).toBe('sm2');
    expect(restored?.due).toBe(original.due);
    expect(restored?.intervalDays).toBe(original.intervalDays);
    expect(restored?.schedulerStates?.fsrs?.fsrs?.stability).toBeGreaterThan(0);
  });
});
