/**
 * Shares one in-flight promise per key, like the extension's
 * `dictionaryLookupsInFlight` maps: repeated lookups of the same word while a
 * request is running reuse that request.
 */
export function createDedupe<T>() {
  const inFlight = new Map<string, Promise<T>>();
  return (key: string, task: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const promise = task().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
