import { DICT_IMPORT_KEY } from '@/data/dictionary';
import { IMAGE_KIND } from '@/services/images/store';
import { db, type HanziStepDB } from './db';
import { planLruEviction, type LruEntry, type LruPlan } from './lru';
import { getStorageStatus, type StorageStatus } from './storage';

/** Default ceiling for stored pictures; everything else in `caches` is tiny. */
export const DEFAULT_IMAGE_BUDGET_BYTES = 40 * 1024 * 1024;

export interface TableUsage {
  table: string;
  label: string;
  rows: number;
  /** Only measured where the rows hold blobs. */
  bytes?: number;
}

export interface StorageReport {
  estimate: StorageStatus | null;
  tables: TableUsage[];
  imageCount: number;
  imageBytes: number;
  dictionaryRows: number;
}

function imageEntries(values: { key: string; kind: string; createdAt: number; value: unknown }[]): LruEntry[] {
  return values
    .filter((entry) => entry.kind === IMAGE_KIND)
    .map((entry) => {
      const stored = entry.value as { bytes?: number; blob?: Blob } | null;
      // `bytes` is written when the picture is saved; records from before that
      // change still carry only the blob.
      const bytes = typeof stored?.bytes === 'number' ? stored.bytes : stored?.blob instanceof Blob ? stored.blob.size : 0;
      return { key: entry.key, bytes, createdAt: entry.createdAt };
    });
}

/**
 * What is actually taking up room. The `audioCache` table exists in the schema
 * but nothing writes to it yet, so it is reported only for completeness.
 */
export async function buildStorageReport(database: HanziStepDB = db): Promise<StorageReport> {
  const [estimate, words, cards, reviewLogs, texts, dictionaryRows, coachSessions, caches, audioCache] = await Promise.all([
    getStorageStatus(),
    database.words.count(),
    database.cards.count(),
    database.reviewLogs.count(),
    database.texts.count(),
    database.dict.count(),
    database.coachSessions.count(),
    database.caches.toArray(),
    database.audioCache.count(),
  ]);

  const images = imageEntries(caches);
  const imageBytes = images.reduce((total, entry) => total + entry.bytes, 0);

  return {
    estimate,
    imageCount: images.length,
    imageBytes,
    dictionaryRows,
    tables: [
      { table: 'words', label: 'Từ vựng', rows: words },
      { table: 'cards', label: 'Thẻ ôn tập', rows: cards },
      { table: 'reviewLogs', label: 'Nhật ký ôn tập', rows: reviewLogs },
      { table: 'texts', label: 'Bài đọc & hội thoại', rows: texts },
      { table: 'coachSessions', label: 'Buổi nói với Coach', rows: coachSessions },
      { table: 'dict', label: 'Từ điển (tải lại được)', rows: dictionaryRows },
      { table: 'caches', label: 'Ảnh minh hoạ', rows: images.length, bytes: imageBytes },
      { table: 'audioCache', label: 'Bộ nhớ đệm âm thanh', rows: audioCache },
    ],
  };
}

/** Trims stored pictures down to a budget, oldest first. */
export async function trimImageCache(maxBytes = DEFAULT_IMAGE_BUDGET_BYTES, database: HanziStepDB = db): Promise<LruPlan> {
  const caches = await database.caches.toArray();
  const plan = planLruEviction(imageEntries(caches), maxBytes);
  if (plan.evict.length === 0) return plan;

  // The owner must stop claiming it has a picture, or the vocabulary list keeps
  // filtering on an image that is no longer there.
  const ownerIds = plan.evict.map((key) => key.slice(IMAGE_KIND.length + 1));
  const now = Date.now();
  await database.transaction('rw', [database.caches, database.words, database.texts], async () => {
    await database.caches.bulkDelete(plan.evict);
    for (const ownerId of ownerIds) {
      await database.words.update(ownerId, { imageStatus: 'none', imageUrl: undefined, updatedAt: now });
      await database.texts.update(ownerId, { imageUrl: undefined });
    }
  });
  return plan;
}

/** Frees the biggest table; the dictionary is rebuilt from the data pack on the next visit. */
export async function clearDictionary(database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', [database.dict, database.kv], async () => {
    await database.dict.clear();
    await database.kv.delete(DICT_IMPORT_KEY);
  });
}
