/**
 * Asks the browser not to evict IndexedDB under storage pressure. There is no
 * sync server, so losing site data means losing progress (JSON backups aside).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageStatus {
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
}

export async function getStorageStatus(): Promise<StorageStatus | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]);
    return { persisted, usageBytes: estimate.usage ?? 0, quotaBytes: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
