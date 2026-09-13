import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import type { TextDoc } from '@/domain/types';
import { completeText, rewardComprehension } from './repository';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`reading-repository-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

function text(overrides: Partial<TextDoc> = {}): TextDoc {
  const questions = Array.from({ length: 4 }, (_, index) => ({
    type: 'short' as const,
    qZh: `问题${index}`,
    qVi: `Câu ${index}`,
    answerZh: '答',
    answerVi: 'Đáp',
  }));
  return {
    id: 'text-1',
    kind: 'pasted',
    title: 'Bài đọc',
    sentences: [{ zh: '你好。' }, { zh: '再见。' }],
    targetWordIds: [],
    questions,
    segOverrides: {},
    progress: { sentenceIndex: 0, openedAt: 1_000 },
    createdAt: 1_000,
    ...overrides,
  };
}

describe('reading completion rewards', () => {
  it('rejects instant or unfinished completion at the repository boundary', async () => {
    const database = freshDb();
    await database.texts.add(text());
    await expect(completeText('text-1', 'read', database, 120_000)).rejects.toThrow('câu cuối');
    await database.texts.update('text-1', { progress: { sentenceIndex: 1, openedAt: 100_000 } });
    await expect(completeText('text-1', 'read', database, 120_000)).rejects.toThrow('ít nhất 1 phút');
    expect((await database.texts.get('text-1'))?.progress.completedAt).toBeUndefined();
  });

  it('completes once and counts listening separately from texts read', async () => {
    const database = freshDb();
    await database.texts.add(text({ progress: { sentenceIndex: 1, openedAt: 1_000 } }));
    expect(await completeText('text-1', 'listen', database, 62_000)).not.toBeNull();
    expect(await completeText('text-1', 'listen', database, 63_000)).toBeNull();
    expect((await database.dailyStats.toArray())[0]?.textsRead).toBe(0);
  });

  it('persists question rewards and enforces the three-question cap', async () => {
    const database = freshDb();
    await database.texts.add(text());
    expect(await rewardComprehension('text-1', 0, database, 10_000)).not.toBeNull();
    expect(await rewardComprehension('text-1', 0, database, 11_000)).toBeNull();
    expect(await rewardComprehension('text-1', 1, database, 12_000)).not.toBeNull();
    expect(await rewardComprehension('text-1', 2, database, 13_000)).not.toBeNull();
    expect(await rewardComprehension('text-1', 3, database, 14_000)).toBeNull();
    expect((await database.texts.get('text-1'))?.progress.comprehensionDone).toEqual([0, 1, 2]);
  });
});
