import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import type { Card, Word } from '@/domain/types';
import { spreadBacklog } from './backlog';

const opened: HanziStepDB[] = [];
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 12, 9);

function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`backlog-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

function word(id: string, tags: string[]): Word {
  return {
    id,
    simplified: id,
    pinyinNum: 'ma1',
    pinyinVariants: [],
    hanViet: '',
    meaningVi: ['nghĩa'],
    meaningEn: [],
    pos: [],
    classifiers: [],
    hsk: {},
    cognate: false,
    source: 'hsk-list',
    examples: [],
    imageStatus: 'none',
    tags,
    createdAt: 0,
    updatedAt: 0,
  };
}

function card(id: string): Card {
  return {
    id: `read:${id}`,
    subjectType: 'word',
    subjectId: id,
    facet: 'read',
    state: 'review',
    repetition: 2,
    easeFactor: 2.5,
    intervalDays: 2,
    due: NOW - DAY,
    lapses: 0,
  };
}

describe('tag-scoped backlog spreading', () => {
  it('moves only the chosen tag and uses zero remaining capacity today', async () => {
    const database = freshDb();
    await database.words.bulkAdd([word('猫', ['animals']), word('水', ['basic'])]);
    await database.cards.bulkAdd([card('猫'), card('水')]);
    await spreadBacklog({ tag: 'animals', perDay: 10, todayCapacity: 0, now: NOW }, database);
    expect((await database.cards.get('read:猫'))?.due).toBeGreaterThanOrEqual(NOW + DAY);
    expect((await database.cards.get('read:水'))?.due).toBe(NOW - DAY);
  });
});
