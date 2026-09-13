import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import type { Word } from '@/domain/types';
import { createCard } from '@/srs/cards';
import { syncWritingCharacters } from './repository';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`writing-repository-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

const word = {
  id: '学生:xue2sheng1', simplified: '学生', pinyinNum: 'xue2 sheng1', pinyinVariants: [], hanViet: 'HỌC SINH',
  meaningVi: ['học sinh'], meaningEn: [], pos: [], classifiers: [], hsk: {}, cognate: false, source: 'manual',
  examples: [], imageStatus: 'none', tags: [], createdAt: 1, updatedAt: 1,
} as Word;

describe('writing repository', () => {
  it('unlocks one idempotent character card per glyph after word mastery', async () => {
    const database = freshDb();
    await database.words.put(word);
    await database.cards.put({ ...createCard(word.id, 'read', 1), repetition: 3 });

    expect(await syncWritingCharacters(database, 10)).toBe(2);
    expect(await syncWritingCharacters(database, 20)).toBe(0);
    expect(await database.chars.toArray()).toEqual([
      expect.objectContaining({ id: '学', pinyin: ['xue2'], meaningsVi: [], hanViet: ['HỌC'] }),
      expect.objectContaining({ id: '生', pinyin: ['sheng1'], meaningsVi: [], hanViet: ['SINH'] }),
    ]);
    expect((await database.cards.where('facet').equals('write').toArray()).map((card) => card.id)).toEqual(['write:学', 'write:生']);
  });

  it('does not unlock writing for a word below repetition three', async () => {
    const database = freshDb();
    await database.words.put(word);
    await database.cards.put({ ...createCard(word.id, 'read', 1), repetition: 2 });

    expect(await syncWritingCharacters(database, 10)).toBe(0);
    expect(await database.chars.count()).toBe(0);
    expect(await database.cards.where('facet').equals('write').count()).toBe(0);
  });
});
