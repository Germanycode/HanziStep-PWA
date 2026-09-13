import { afterEach, describe, expect, it } from 'vitest';
import { tonelessKey } from '@/chinese/pinyin/keys';
import { HanziStepDB } from '@/db/db';
import { dictRowToEntry, lookupHeadword, searchDictionary } from './dictionary';
import type { DictRow } from './types';

const opened: HanziStepDB[] = [];
async function seededDb(): Promise<HanziStepDB> {
  const database = new HanziStepDB(`dict-test-${crypto.randomUUID()}`);
  opened.push(database);
  const rows: DictRow[] = [
    ['银行', '銀行', 'yin2 hang2', ['bank'], ['ngân hàng'], ['家']],
    ['银', '銀', 'yin2', ['silver'], ['bạc'], []],
    ['你好', '你好', 'ni3 hao3', ['hello'], ['xin chào'], []],
    ['你', '你', 'ni3', ['you'], ['bạn'], []],
    ['女', '女', 'nü3', ['female'], ['nữ'], []],
    ['学', '學', 'xue2', ['to learn'], ['học'], []],
  ];
  await database.dict.bulkAdd(rows.map(dictRowToEntry));
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

describe('dictionary', () => {
  it('builds toneless search keys', () => {
    expect(tonelessKey('Nǐ hǎo')).toBe('nihao');
    expect(tonelessKey('ni3 hao3')).toBe('nihao');
    expect(tonelessKey('lǚ / lu:3 / lv3')).toBe('lvlvlv');
    expect(dictRowToEntry(['女', '女', 'nü3', [], [], []]).pt).toBe('nv');
  });

  it('looks up simplified or traditional headwords', async () => {
    const database = await seededDb();
    expect((await lookupHeadword('银行', database)).map((entry) => entry.p)).toEqual(['yin2 hang2']);
    expect((await lookupHeadword('學', database)).map((entry) => entry.s)).toEqual(['学']);
    expect(await lookupHeadword('猫', database)).toEqual([]);
  });

  it('searches by character prefix with exact matches first', async () => {
    const database = await seededDb();
    expect((await searchDictionary('银', 10, database)).map((entry) => entry.s)).toEqual(['银', '银行']);
    expect((await searchDictionary('銀行', 10, database)).map((entry) => entry.s)).toEqual(['银行']);
  });

  it('searches by pinyin with or without tones', async () => {
    const database = await seededDb();
    expect((await searchDictionary('ni', 10, database)).map((entry) => entry.s)).toEqual(['你', '你好']);
    expect((await searchDictionary('nǐ hǎo', 10, database)).map((entry) => entry.s)).toEqual(['你好']);
    expect((await searchDictionary('nv3', 10, database)).map((entry) => entry.s)).toEqual(['女']);
    expect(await searchDictionary('   ', 10, database)).toEqual([]);
  });
});
