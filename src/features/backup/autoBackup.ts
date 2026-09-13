import { db, type HanziStepDB } from '@/db/db';
import { createBackup } from './backup';

/**
 * Weekly backup into a folder the learner picks once (docs/PLAN.md §9, Phase 5).
 * There is no sync server, so this is the only thing standing between a cleared
 * browser profile and losing everything.
 */

export const BACKUP_FOLDER_KEY = 'backupFolder';
export const LAST_BACKUP_KEY = 'lastBackupAt';
export const REMIND_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

interface DirectoryPickerWindow {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>;
}

/** Permission methods are not in the DOM types yet. */
interface PermissionCapableHandle {
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export function autoBackupSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

export function backupFileName(date: Date): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `hanzistep-backup-${day}.json`;
}

/** True when the last backup is older than a week (or there has never been one). */
export function shouldRemind(lastBackupAt: number | null, now: number, afterDays = REMIND_AFTER_DAYS): boolean {
  if (lastBackupAt === null) return true;
  return now - lastBackupAt >= afterDays * DAY_MS;
}

export async function getLastBackupAt(database: HanziStepDB = db): Promise<number | null> {
  const value = (await database.kv.get(LAST_BACKUP_KEY))?.value;
  return typeof value === 'number' ? value : null;
}

export async function getBackupFolder(database: HanziStepDB = db): Promise<FileSystemDirectoryHandle | null> {
  const value = (await database.kv.get(BACKUP_FOLDER_KEY))?.value;
  return value && typeof value === 'object' && 'getFileHandle' in value ? (value as FileSystemDirectoryHandle) : null;
}

export async function forgetBackupFolder(database: HanziStepDB = db): Promise<void> {
  await database.kv.delete(BACKUP_FOLDER_KEY);
}

/** Asks once and remembers; the handle survives restarts in IndexedDB. */
export async function pickBackupFolder(database: HanziStepDB = db): Promise<FileSystemDirectoryHandle> {
  const picker = (window as unknown as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Trình duyệt này không chọn được thư mục (hãy dùng Edge hoặc Chrome).');
  const handle = await picker({ mode: 'readwrite', id: 'hanzistep-backup' });
  await database.kv.put({ key: BACKUP_FOLDER_KEY, value: handle });
  return handle;
}

async function ensureWritable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const permissions = handle as unknown as PermissionCapableHandle;
  const current = (await permissions.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  if (current === 'granted') return true;
  const asked = (await permissions.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
  return asked === 'granted';
}

export interface AutoBackupResult {
  fileName: string;
  bytes: number;
  at: number;
}

/**
 * Writes a dated backup into the chosen folder. Throws when no folder has been
 * picked yet, so the caller can fall back to the normal download.
 */
export async function backupToFolder(
  options: { includeSecrets?: boolean; now?: Date } = {},
  database: HanziStepDB = db,
): Promise<AutoBackupResult> {
  const handle = await getBackupFolder(database);
  if (!handle) throw new Error('Chưa chọn thư mục sao lưu.');
  if (!(await ensureWritable(handle))) throw new Error('Chưa được phép ghi vào thư mục đã chọn.');

  const now = options.now ?? new Date();
  const backup = await createBackup({ includeSecrets: options.includeSecrets ?? false });
  const text = JSON.stringify(backup, null, 2);
  const fileName = backupFileName(now);

  const file = await handle.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();

  const at = now.getTime();
  await database.kv.put({ key: LAST_BACKUP_KEY, value: at });
  return { fileName, bytes: text.length, at };
}
