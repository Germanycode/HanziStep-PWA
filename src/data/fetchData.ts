/** Fetches a generated data file; the dev server answers missing files with index.html, so the type is checked. */
export async function fetchDataJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
    throw new Error(`Chưa có dữ liệu “${url}”. Hãy build gói dữ liệu (npm run data:build).`);
  }
  return (await response.json()) as T;
}

/** Caches one promise per key and forgets failures so they can be retried. */
export function cachedLoader<K, T>(load: (key: K) => Promise<T>): (key: K) => Promise<T> {
  const cache = new Map<K, Promise<T>>();
  return (key: K) => {
    let promise = cache.get(key);
    if (!promise) {
      promise = load(key).catch((error: unknown) => {
        cache.delete(key);
        throw error;
      });
      cache.set(key, promise);
    }
    return promise;
  };
}
