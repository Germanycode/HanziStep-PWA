/**
 * Dexie schema. Never edit a released version: add a new version with
 * `.upgrade()` in db.ts and a matching test instead.
 */
export const SCHEMA_V1 = {
  words:
    'id, &[simplified+pinyinNum], simplified, source, createdAt, updatedAt, *tags, hsk.hsk2, hsk.hsk3, hsk.hsk3Newest',
  cards: 'id, &[subjectType+subjectId+facet], subjectId, facet, state, due, [facet+due]',
  reviewLogs: '++id, cardId, subjectId, dayKey, reviewedAt, [facet+dayKey]',
  dailyStats: 'dayKey',
  texts: 'id, kind, level, createdAt',
  dict: '++id, s, t, pt',
  caches: 'key, kind, expiresAt',
  audioCache: 'key, createdAt, bytes',
  coachSessions: 'id, startedAt',
  kv: 'key',
} as const;

/** Same indexes; v2 adds non-indexed durability/idempotency fields to rows. */
export const SCHEMA_V2 = SCHEMA_V1;

/** Phase 6: character subjects for stroke-writing cards. */
export const SCHEMA_V3 = {
  ...SCHEMA_V2,
  chars: 'id, character, updatedAt, *wordIds',
} as const;

/** Same indexes; v4 repairs positional metadata created by the original v3 migration. */
export const SCHEMA_V4 = SCHEMA_V3;

export type TableName = keyof typeof SCHEMA_V4;

/** Tables written to JSON backups. `dict`, `caches` and `audioCache` can be rebuilt, so they are skipped. */
export const BACKUP_TABLES = ['words', 'chars', 'cards', 'reviewLogs', 'dailyStats', 'texts', 'coachSessions', 'kv'] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];
