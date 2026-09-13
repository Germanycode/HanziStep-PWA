import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createCard } from '@/srs/cards';
import type { Word } from '@/domain/types';
import { HanziStepDB } from './db';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3 } from './schema';

const names: string[] = [];
afterEach(async () => Promise.all(names.splice(0).map((name) => Dexie.delete(name))));

describe('Dexie v3 writing migration', () => {
  it('keeps v2 data and creates one character card for a mastered word', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    names.push(name);
    const old = new Dexie(name);
    old.version(1).stores(SCHEMA_V1);
    old.version(2).stores(SCHEMA_V2);
    await old.open();
    const word = {
      id: '你好:ni3hao3', simplified: '你好', pinyinNum: 'ni3 hao3', pinyinVariants: [], hanViet: 'NỄ HẢO',
      meaningVi: ['xin chào'], meaningEn: [], pos: [], classifiers: [], hsk: {}, cognate: false, source: 'manual',
      examples: [], imageStatus: 'none', tags: [], createdAt: 1, updatedAt: 1,
    } as Word;
    await old.table('words').put(word);
    await old.table('cards').put({ ...createCard(word.id, 'read', 1), repetition: 3 });
    old.close();

    const upgraded = new HanziStepDB(name);
    await upgraded.open();
    expect(await upgraded.words.get(word.id)).toBeTruthy();
    expect(await upgraded.chars.toArray()).toEqual([
      expect.objectContaining({ id: '你', pinyin: ['ni3'], hanViet: ['NỄ'], meaningsVi: [] }),
      expect.objectContaining({ id: '好', pinyin: ['hao3'], hanViet: ['HẢO'], meaningsVi: [] }),
    ]);
    expect((await upgraded.cards.where('facet').equals('write').toArray()).map((card) => card.subjectType)).toEqual(['char', 'char']);
    upgraded.close();
  });

  it('repairs corrupt positional metadata already created by database v3', async () => {
    const name = `migration-v4-${crypto.randomUUID()}`;
    names.push(name);
    const old = new Dexie(name);
    old.version(1).stores(SCHEMA_V1);
    old.version(2).stores(SCHEMA_V2);
    old.version(3).stores(SCHEMA_V3);
    await old.open();
    const word = {
      id: '弟弟:di4di5', simplified: '弟弟', pinyinNum: 'di4 di5', pinyinVariants: [], hanViet: 'ĐỆ ĐỆ',
      meaningVi: ['em trai'], meaningEn: [], pos: [], classifiers: [], hsk: {}, cognate: false, source: 'manual',
      examples: [], imageStatus: 'none', tags: [], createdAt: 1, updatedAt: 1,
    } as Word;
    await old.table('words').put(word);
    await old.table('chars').put({
      id: '弟', character: '弟', wordIds: [word.id], pinyin: ['di4', 'di5'], meaningsVi: ['em trai'],
      hanViet: ['ĐỆ'], createdAt: 1, updatedAt: 1,
    });
    old.close();

    const upgraded = new HanziStepDB(name);
    await upgraded.open();
    expect(await upgraded.chars.get('弟')).toEqual(expect.objectContaining({
      pinyin: ['di4', 'di5'], meaningsVi: [], hanViet: ['ĐỆ'], createdAt: 1,
    }));
    upgraded.close();
  });
});
