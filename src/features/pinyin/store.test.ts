import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import { completeLesson, drillAccuracy, getDrillStats, getPinyinProgress, saveDrillAnswer } from './store';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`pinyin-store-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

describe('pinyin store', () => {
  it('awards lesson XP only the first time', async () => {
    const database = freshDb();
    const first = await completeLesson('tones', database);
    expect(first?.xpAwarded).toBe(25);
    expect(await completeLesson('tones', database)).toBeNull();
    expect((await getPinyinProgress(database)).completedLessons).toEqual(['tones']);
  });

  it('saves drill answers and reports accuracy per drill', async () => {
    const database = freshDb();
    await saveDrillAnswer('tone:3', false, true, database, 1);
    await saveDrillAnswer('tone:3', true, true, database, 2);
    await saveDrillAnswer('minimal:n-l', true, false, database, 3);
    const stats = await getDrillStats(database);
    expect(stats.items['tone:3']?.attempts).toBe(2);
    expect(stats.toneCorrectTotal).toBe(1);
    expect(stats.toneRecent).toEqual([0, 1]);
    expect(drillAccuracy(stats, 'tone:')).toBeCloseTo(1 - 0.455);
    expect(drillAccuracy(stats, 'pair:')).toBeNull();
  });
});
