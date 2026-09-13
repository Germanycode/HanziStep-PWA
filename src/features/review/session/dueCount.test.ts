import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import type { Card, Facet, Word } from '@/domain/types';
import { loadDueCount } from './useReviewSnapshot';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`due-count-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

const NOW = Date.UTC(2026, 8, 12, 9);
const DAY = 86_400_000;

function word(id: string, overrides: Partial<Word> = {}): Word {
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
    tags: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function card(subjectId: string, facet: Facet, due: number, state: Card['state'] = 'review'): Card {
  return {
    id: `${facet}:${subjectId}`,
    subjectType: 'word',
    subjectId,
    facet,
    state,
    repetition: 2,
    easeFactor: 2.5,
    intervalDays: 3,
    due,
    lapses: 0,
  };
}

describe('loadDueCount (app badge)', () => {
  it('counts a word once even when two facets are due', async () => {
    const database = freshDb();
    await database.words.add(word('猫'));
    await database.cards.bulkAdd([card('猫', 'read', NOW - DAY), card('猫', 'listen', NOW - DAY)]);
    expect(await loadDueCount(NOW, database)).toBe(1);
  });

  it('ignores suspended cards, known words and cards whose word is gone', async () => {
    const database = freshDb();
    await database.words.bulkAdd([word('猫'), word('狗', { knownWithoutSrs: true })]);
    await database.cards.bulkAdd([
      card('猫', 'read', NOW - DAY),
      card('猫', 'speak', NOW - DAY, 'suspended'),
      card('狗', 'read', NOW - DAY),
      card('孤', 'read', NOW - DAY),
    ]);
    expect(await loadDueCount(NOW, database)).toBe(1);
  });

  it('ignores cards that are not due yet', async () => {
    const database = freshDb();
    await database.words.add(word('猫'));
    await database.cards.add(card('猫', 'read', NOW + DAY));
    expect(await loadDueCount(NOW, database)).toBe(0);
  });

  it('is zero on an empty collection', async () => {
    expect(await loadDueCount(NOW, freshDb())).toBe(0);
  });
});
