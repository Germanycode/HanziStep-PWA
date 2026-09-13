/** Least-recently-added eviction for cached blobs (docs/PLAN.md §9, Phase 5). */

export interface LruEntry {
  key: string;
  bytes: number;
  /** Newest entries are kept first. */
  createdAt: number;
}

export interface LruPlan {
  evict: string[];
  freedBytes: number;
  keptBytes: number;
}

/**
 * Keeps the newest entries that fit in `maxBytes` and evicts the rest, oldest
 * first. An entry larger than the whole budget is evicted too.
 */
export function planLruEviction(entries: readonly LruEntry[], maxBytes: number): LruPlan {
  const newestFirst = [...entries].sort((a, b) => b.createdAt - a.createdAt || a.key.localeCompare(b.key));
  const budget = Math.max(0, maxBytes);

  let keptBytes = 0;
  const evict: string[] = [];
  let freedBytes = 0;
  for (const entry of newestFirst) {
    const size = Math.max(0, entry.bytes);
    if (keptBytes + size <= budget) {
      keptBytes += size;
      continue;
    }
    evict.push(entry.key);
    freedBytes += size;
  }
  return { evict, freedBytes, keptBytes };
}
