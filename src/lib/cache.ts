/**
 * In-memory TTL cache with least-recently-used eviction. Port of the English
 * app's `readCachedValue` / `cacheValue` (background.js). For caches that must
 * survive reloads, use the Dexie `caches` table instead.
 */
export class MemoryCache<V> {
  private readonly entries = new Map<string, { value: V; savedAt: number }>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(maxEntries = 200, now: () => number = Date.now) {
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get(key: string, maxAgeMs: number): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.savedAt >= maxAgeMs) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so Map order tracks recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, savedAt: this.now() });
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
