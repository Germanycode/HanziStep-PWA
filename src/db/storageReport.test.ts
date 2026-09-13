import { afterEach, describe, expect, it } from 'vitest';
import { IMAGE_KIND, imageCacheKey } from '@/services/images/store';
import { HanziStepDB } from './db';
import { trimImageCache } from './storageReport';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`storage-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

async function seedImage(database: HanziStepDB, wordId: string, bytes: number, createdAt: number) {
  await database.words.add({
    id: wordId,
    simplified: wordId,
    pinyinNum: 'ma1',
    pinyinVariants: [],
    hanViet: '',
    meaningVi: [],
    meaningEn: [],
    pos: [],
    classifiers: [],
    hsk: {},
    cognate: false,
    source: 'manual',
    examples: [],
    imageStatus: 'ok',
    imageUrl: 'https://example.test/photo',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  });
  await database.caches.put({
    key: imageCacheKey(wordId),
    kind: IMAGE_KIND,
    value: { blob: new Blob(['x'.repeat(bytes)]), bytes, source: 'pixabay', pageUrl: 'https://example.test/photo', author: 'ai đó' },
    createdAt,
    expiresAt: createdAt + 1_000_000,
  });
}

describe('trimImageCache', () => {
  it('keeps everything inside the budget', async () => {
    const database = freshDb();
    await seedImage(database, 'old', 1000, 1);
    const plan = await trimImageCache(10_000, database);
    expect(plan.evict).toEqual([]);
    expect((await database.words.get('old'))?.imageStatus).toBe('ok');
  });

  it('evicts the oldest picture and stops the word claiming it has one', async () => {
    const database = freshDb();
    await seedImage(database, 'old', 1000, 1);
    await seedImage(database, 'new', 1000, 2);

    const plan = await trimImageCache(1000, database);
    expect(plan.evict).toEqual([imageCacheKey('old')]);
    expect(await database.caches.get(imageCacheKey('old'))).toBeUndefined();

    const evicted = await database.words.get('old');
    expect(evicted?.imageStatus).toBe('none');
    expect(evicted?.imageUrl).toBeUndefined();

    // The picture that fit is untouched.
    expect((await database.words.get('new'))?.imageStatus).toBe('ok');
    expect(await database.caches.get(imageCacheKey('new'))).toBeDefined();
  });
});
