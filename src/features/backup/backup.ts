import { z } from 'zod';
import { db, type HanziStepDB } from '@/db/db';
import { BACKUP_TABLES, type BackupTableName } from '@/db/schema';
import { normalizeSettings, SECRET_SETTING_KEYS, SETTINGS_KEY } from '@/db/settings';
import type { CacheEntry, KvEntry, Settings } from '@/domain/types';
import { toDayKey } from '@/lib/dayKey';
import { IMAGE_KIND, imageCacheKey, isStoredImage, type StoredImage } from '@/services/images/store';
import {
  backupFileSchema,
  type BackupData,
  type BackupImage,
  type ValidatedBackupFile,
} from './validation';

export const BACKUP_FORMAT = 'hanzistep-backup';
export const BACKUP_SCHEMA_VERSION = 3;

export type { BackupData, BackupImage } from './validation';
export type BackupFile = ValidatedBackupFile;

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

function tablesOf(database: HanziStepDB) {
  return BACKUP_TABLES.map((name) => database.table(name));
}

function withoutSecrets(entry: KvEntry): KvEntry {
  const value = entry.value;
  if (entry.key !== SETTINGS_KEY || value === null || typeof value !== 'object') return entry;
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of SECRET_SETTING_KEYS) delete copy[key];
  return { ...entry, value: copy };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new BackupError('Bản sao lưu chứa ảnh không hợp lệ.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function serializeImage(entry: CacheEntry): Promise<BackupImage | null> {
  if (!entry.key.startsWith(`${IMAGE_KIND}:`) || !isStoredImage(entry.value)) return null;
  const bytes = new Uint8Array(await entry.value.blob.arrayBuffer());
  return {
    ownerId: entry.key.slice(IMAGE_KIND.length + 1),
    mimeType: entry.value.blob.type || 'application/octet-stream',
    base64: bytesToBase64(bytes),
    bytes: bytes.length,
    source: entry.value.source,
    pageUrl: entry.value.pageUrl,
    author: entry.value.author,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  };
}

function deserializeImage(image: BackupImage): CacheEntry {
  const bytes = base64ToBytes(image.base64);
  if (bytes.length !== image.bytes) throw new BackupError(`Ảnh của “${image.ownerId}” sai kích thước.`);
  const value: StoredImage = {
    blob: new Blob([Uint8Array.from(bytes).buffer], { type: image.mimeType }),
    bytes: image.bytes,
    source: image.source,
    pageUrl: image.pageUrl,
    author: image.author,
  };
  return {
    key: imageCacheKey(image.ownerId),
    kind: IMAGE_KIND,
    value,
    createdAt: image.createdAt,
    expiresAt: image.expiresAt,
  };
}

function assertUnique<T>(rows: readonly T[], label: string, keyOf: (row: T) => string | number | undefined): void {
  const seen = new Set<string | number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === undefined) continue;
    if (seen.has(key)) throw new BackupError(`Bản sao lưu có ${label} trùng khoá “${String(key)}”.`);
    seen.add(key);
  }
}

function assertBackupIntegrity(backup: BackupFile): void {
  assertUnique(backup.data.words, 'từ', (row) => row.id);
  assertUnique(backup.data.chars, 'chữ', (row) => row.id);
  assertUnique(backup.data.cards, 'thẻ', (row) => row.id);
  assertUnique(backup.data.reviewLogs, 'nhật ký', (row) => row.id);
  assertUnique(backup.data.dailyStats, 'thống kê ngày', (row) => row.dayKey);
  assertUnique(backup.data.texts, 'bài đọc', (row) => row.id);
  assertUnique(backup.data.coachSessions, 'phiên Coach', (row) => row.id);
  assertUnique(backup.data.kv, 'cài đặt', (row) => row.key);
  assertUnique(backup.images, 'ảnh', (row) => row.ownerId);

  const wordIds = new Set(backup.data.words.map((row) => row.id));
  const charIds = new Set(backup.data.chars.map((row) => row.id));
  for (const char of backup.data.chars) {
    if (char.wordIds.some((id) => !wordIds.has(id))) throw new BackupError(`Chữ “${char.id}” tham chiếu tới từ không tồn tại.`);
  }
  for (const card of backup.data.cards) {
    if (card.subjectType === 'word' && !wordIds.has(card.subjectId)) {
      throw new BackupError(`Thẻ “${card.id}” tham chiếu tới từ không tồn tại.`);
    }
    if (card.subjectType === 'char' && !charIds.has(card.subjectId)) {
      throw new BackupError(`Thẻ “${card.id}” tham chiếu tới chữ không tồn tại.`);
    }
  }
  const owners = new Set([...wordIds, ...backup.data.texts.map((row) => row.id)]);
  for (const image of backup.images) {
    if (!owners.has(image.ownerId)) throw new BackupError(`Ảnh tham chiếu tới dữ liệu không tồn tại: “${image.ownerId}”.`);
    // Decode before restore opens a write transaction. A corrupt image must not
    // be able to clear any current table.
    const bytes = base64ToBytes(image.base64);
    if (bytes.length !== image.bytes) throw new BackupError(`Ảnh của “${image.ownerId}” sai kích thước.`);
  }
}

export async function createBackup(
  options: { includeSecrets?: boolean; database?: HanziStepDB; now?: Date } = {},
): Promise<BackupFile> {
  const { includeSecrets = false, database = db, now = new Date() } = options;
  const { data, imageEntries } = await database.transaction('r', [...tablesOf(database), database.caches], async () => ({
    data: {
      words: await database.words.toArray(),
      chars: await database.chars.toArray(),
      cards: await database.cards.toArray(),
      reviewLogs: await database.reviewLogs.toArray(),
      dailyStats: await database.dailyStats.toArray(),
      texts: await database.texts.toArray(),
      coachSessions: await database.coachSessions.toArray(),
      kv: await database.kv.toArray(),
    } satisfies BackupData,
    imageEntries: await database.caches.where('kind').equals(IMAGE_KIND).toArray(),
  }));
  if (!includeSecrets) data.kv = data.kv.map(withoutSecrets);
  const images = (await Promise.all(imageEntries.map(serializeImage))).filter((image): image is BackupImage => image !== null);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: __APP_VERSION__,
    exportedAt: now.toISOString(),
    includesSecrets: includeSecrets,
    data,
    images,
  };
}

/** Upgrades older backup files one version at a time. */
export function migrateBackup(input: Record<string, unknown>): Record<string, unknown> {
  if (input.schemaVersion === 1) {
    const data = input.data && typeof input.data === 'object' ? (input.data as Record<string, unknown>) : {};
    const words = Array.isArray(data.words)
      ? data.words.map((row) => {
          if (!row || typeof row !== 'object') return row;
          const word = row as Record<string, unknown>;
          return Array.isArray(word.tags) && word.tags.length > 0 && word.tagRewardedAt === undefined
            ? { ...word, tagRewardedAt: word.updatedAt }
            : word;
        })
      : data.words;
    return migrateBackup({ ...input, schemaVersion: 2, images: [], data: { ...data, words } });
  }
  if (input.schemaVersion === 2) {
    const data = input.data && typeof input.data === 'object' ? (input.data as Record<string, unknown>) : {};
    return { ...input, schemaVersion: 3, data: { ...data, chars: [] } };
  }
  return input;
}

export function parseBackup(input: unknown): BackupFile {
  const header = z.object({ format: z.literal(BACKUP_FORMAT), schemaVersion: z.number().int() }).safeParse(input);
  if (!header.success) throw new BackupError('Tệp này không phải bản sao lưu HanziStep.');
  if (header.data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('Bản sao lưu được tạo từ phiên bản HanziStep mới hơn. Hãy cập nhật ứng dụng trước.');
  }
  const parsed = backupFileSchema.safeParse(migrateBackup(input as Record<string, unknown>));
  if (!parsed.success) throw new BackupError('Bản sao lưu bị hỏng hoặc thiếu dữ liệu.');
  assertBackupIntegrity(parsed.data);
  return parsed.data;
}

export interface RestoreSummary {
  counts: Record<BackupTableName, number>;
  images: number;
  keptCurrentSecrets: boolean;
}

function normalizeImageReferences(data: BackupData, images: readonly BackupImage[]): BackupData {
  const owners = new Set(images.map((image) => image.ownerId));
  return {
    ...data,
    words: data.words.map((word) => {
      return word.imageStatus === 'ok' && !owners.has(word.id)
        ? { ...word, imageStatus: 'none' as const, imageUrl: undefined }
        : word;
    }),
    texts: data.texts.map((text) => (text.imageUrl && !owners.has(text.id) ? { ...text, imageUrl: undefined } : text)),
  };
}

/**
 * Replaces all learning data and stored pictures in one transaction. Validation
 * and image decoding happen first, so a corrupt file leaves current data intact.
 */
export async function restoreBackup(input: BackupFile, database: HanziStepDB = db): Promise<RestoreSummary> {
  const backup = parseBackup(input);
  const data = normalizeImageReferences(backup.data, backup.images);
  const imageEntries = backup.images.map(deserializeImage);
  let keptCurrentSecrets = false;
  await database.transaction('rw', [...tablesOf(database), database.caches], async () => {
    const currentSettings = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
    for (const name of BACKUP_TABLES) await database.table(name).clear();
    for (const name of BACKUP_TABLES) await database.table(name).bulkPut(data[name]);
    await database.caches.where('kind').equals(IMAGE_KIND).delete();
    if (imageEntries.length > 0) await database.caches.bulkPut(imageEntries);

    if (!backup.includesSecrets) {
      const restored = (await database.kv.get(SETTINGS_KEY)) as KvEntry | undefined;
      const secrets: Partial<Settings> = {};
      for (const key of SECRET_SETTING_KEYS) secrets[key] = currentSettings[key];
      const base = restored?.value !== null && typeof restored?.value === 'object' ? restored.value : {};
      await database.kv.put({ key: SETTINGS_KEY, value: normalizeSettings({ ...base, ...secrets }) });
      keptCurrentSecrets = true;
    }
  });
  const counts = Object.fromEntries(BACKUP_TABLES.map((name) => [name, data[name].length])) as Record<BackupTableName, number>;
  return { counts, images: imageEntries.length, keptCurrentSecrets };
}

export function backupFileName(now: Date = new Date()): string {
  return `hanzistep-backup-${toDayKey(now)}.json`;
}

export async function readBackupFile(file: File): Promise<BackupFile> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new BackupError('Không đọc được tệp JSON.');
  }
  return parseBackup(json);
}

export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(new Date(backup.exportedAt));
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
