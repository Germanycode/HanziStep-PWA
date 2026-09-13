import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import { getSettings, updateSettings } from '@/db/settings';
import type { Card, DailyStats, ReviewLog, Word } from '@/domain/types';
import { BACKUP_FORMAT, BackupError, createBackup, parseBackup, restoreBackup, type BackupFile } from './backup';
import { imageCacheKey } from '@/services/images/store';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`backup-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

const word: Word = {
  id: 'w1',
  simplified: '银行',
  traditional: '銀行',
  pinyinNum: 'yin2 hang2',
  pinyinVariants: [],
  hanViet: 'NGÂN HÀNG',
  meaningVi: ['ngân hàng'],
  meaningEn: ['bank'],
  pos: ['n'],
  classifiers: ['家'],
  hsk: { hsk3: 2 },
  cognate: true,
  source: 'hsk-list',
  examples: [{ zh: '我去银行。', vi: 'Tôi đi ngân hàng.', source: 'user' }],
  imageStatus: 'none',
  tags: ['HSK2'],
  createdAt: 1,
  updatedAt: 2,
};

const card: Card = {
  id: 'c1',
  subjectType: 'word',
  subjectId: 'w1',
  facet: 'read',
  state: 'review',
  repetition: 2,
  easeFactor: 2.5,
  intervalDays: 1,
  due: 1_000,
  lapses: 0,
};

const log: ReviewLog = {
  id: 7,
  cardId: 'c1',
  subjectId: 'w1',
  facet: 'read',
  questionType: 'mcq-hanzi-vi',
  mode: 'review',
  correct: true,
  quality: 4,
  rating: 3,
  elapsedMs: 2_500,
  hints: 0,
  replays: 0,
  reviewedAt: 900,
  dayKey: '2026-09-11',
  before: { repetition: 1, easeFactor: 2.5, intervalDays: 0.0139, due: 800 },
  after: { repetition: 2, easeFactor: 2.5, intervalDays: 1, due: 1_000 },
};

const stats: DailyStats = {
  dayKey: '2026-09-11',
  xp: 45,
  learningXp: 45,
  xpByKind: { 'review-correct': 45 },
  eventsByKind: { 'review-correct': 3 },
  answers: 3,
  correct: 3,
  newIntroduced: 0,
  textsRead: 0,
  dictations: 0,
  speakingAttempts: 0,
  drillItems: 0,
  coachSeconds: 0,
};

async function seed(database: HanziStepDB) {
  await database.words.put(word);
  await database.cards.put(card);
  await database.reviewLogs.put(log);
  await database.dailyStats.put(stats);
  await database.kv.put({ key: 'gamification', value: { xp: 45, badges: ['first_word'] } });
  await database.dict.add({ s: '银行', t: '銀行', p: 'yin2 hang2', pt: 'yinhang', en: ['bank'], vi: ['ngân hàng'], cl: [] });
}

describe('backup round-trip', () => {
  it('restores learning data exactly, keeps local secrets, and leaves the dictionary alone', async () => {
    const source = freshDb();
    await seed(source);
    await updateSettings({ geminiApiKey: 'secret-source', theme: 'light', newWordsPerDay: 8 }, source);

    const backup = await createBackup({ database: source, now: new Date(2026, 8, 11, 20, 0) });
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toContain('secret-source');
    expect(backup.data).not.toHaveProperty('dict');

    const target = freshDb();
    await updateSettings({ geminiApiKey: 'secret-target' }, target);
    await target.dict.add({ s: '你好', t: '你好', p: 'ni3 hao3', pt: 'nihao', en: ['hello'], vi: ['xin chào'], cl: [] });
    await target.words.put({ ...word, id: 'will-be-replaced', simplified: '旧', pinyinNum: 'jiu4' });

    const summary = await restoreBackup(parseBackup(JSON.parse(serialized)), target);

    expect(summary.counts).toMatchObject({ words: 1, cards: 1, reviewLogs: 1, dailyStats: 1 });
    expect(summary.keptCurrentSecrets).toBe(true);
    for (const table of ['words', 'cards', 'reviewLogs', 'dailyStats', 'texts', 'coachSessions'] as const) {
      expect(await target.table(table).toArray()).toEqual(await source.table(table).toArray());
    }
    expect(await target.kv.get('gamification')).toEqual({ key: 'gamification', value: { xp: 45, badges: ['first_word'] } });
    const settings = await getSettings(target);
    expect(settings.theme).toBe('light');
    expect(settings.newWordsPerDay).toBe(8);
    expect(settings.geminiApiKey).toBe('secret-target');
    expect(await target.dict.count()).toBe(1);
  });

  it('exports API keys only when asked', async () => {
    const database = freshDb();
    await updateSettings({ geminiApiKey: 'secret' }, database);
    const backup = await createBackup({ database, includeSecrets: true });
    expect(backup.includesSecrets).toBe(true);
    expect(JSON.stringify(backup)).toContain('secret');
  });

  it('round-trips stored pictures and their owner metadata', async () => {
    const source = freshDb();
    await source.words.put({ ...word, imageStatus: 'ok', imageUrl: 'https://pixabay.test/photo' });
    const base = await createBackup({ database: source });
    const backup: BackupFile = {
      ...base,
      images: [
        {
          ownerId: word.id,
          mimeType: 'image/png',
          base64: 'AQIDBA==',
          bytes: 4,
          source: 'pixabay',
          pageUrl: 'https://pixabay.test/photo',
          author: 'Tester',
          createdAt: 10,
          expiresAt: 20,
        },
      ],
    };
    expect(backup.images).toHaveLength(1);
    const target = freshDb();
    await restoreBackup(parseBackup(JSON.parse(JSON.stringify(backup))), target);

    const restored = await target.caches.get(imageCacheKey(word.id));
    expect((restored?.value as { bytes?: number })?.bytes).toBe(4);
    expect((await target.words.get(word.id))?.imageStatus).toBe('ok');
  });

  it('migrates a complete v1 backup but clears picture flags it cannot restore', async () => {
    const database = freshDb();
    await database.words.put({ ...word, imageStatus: 'ok', imageUrl: 'https://example.test/missing' });
    const current = await createBackup({ database });
    const { images: _images, ...withoutImages } = current;
    const migrated = parseBackup({ ...withoutImages, schemaVersion: 1 });
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.images).toEqual([]);

    const target = freshDb();
    await restoreBackup(migrated, target);
    expect(await target.words.get(word.id)).toMatchObject({ imageStatus: 'none' });
    expect((await target.words.get(word.id))?.imageUrl).toBeUndefined();
  });

  it('rolls back completely when a row cannot be written', async () => {
    const database = freshDb();
    await seed(database);
    const broken = {
      ...(await createBackup({ database })),
      data: { ...(await createBackup({ database })).data, cards: [{ notAnId: true }] },
    } as unknown as BackupFile;
    await expect(restoreBackup(broken, database)).rejects.toThrow();
    expect(await database.words.get('w1')).toEqual(word);
    expect(await database.cards.get('c1')).toEqual(card);
  });
});

describe('parseBackup', () => {
  it('rejects files that are not HanziStep backups', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow(BackupError);
    expect(() => parseBackup([])).toThrow(BackupError);
  });

  it('rejects backups from a newer schema', () => {
    expect(() => parseBackup({ format: BACKUP_FORMAT, schemaVersion: 99 })).toThrow(/mới hơn/);
  });

  it('rejects rows with missing domain fields and rejects every missing table', async () => {
    const valid = await createBackup({ database: freshDb() });
    expect(() => parseBackup({ ...valid, data: { ...valid.data, words: [{ id: 'partial' }] } })).toThrow(BackupError);
    expect(() => parseBackup({ ...valid, data: {} })).toThrow(BackupError);
    const { reviewLogs: _reviewLogs, ...missingOne } = valid.data;
    expect(() => parseBackup({ ...valid, data: missingOne })).toThrow(BackupError);
  });
});
