import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from './cache';
import { createDedupe } from './dedupe';

describe('MemoryCache', () => {
  it('expires entries after maxAge', () => {
    let now = 1_000;
    const cache = new MemoryCache<string>(10, () => now);
    cache.set('a', 'A');
    expect(cache.get('a', 500)).toBe('A');
    now += 500;
    expect(cache.get('a', 500)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used entry', () => {
    const cache = new MemoryCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a', 60_000)).toBe(1); // a is now most recent
    cache.set('c', 3);
    expect(cache.get('b', 60_000)).toBeUndefined();
    expect(cache.get('a', 60_000)).toBe(1);
    expect(cache.get('c', 60_000)).toBe(3);
  });
});

describe('createDedupe', () => {
  it('runs one task per key while it is in flight, then allows a new one', async () => {
    const dedupe = createDedupe<string>();
    const task = vi.fn(async () => 'result');
    const [first, second] = await Promise.all([dedupe('k', task), dedupe('k', task)]);
    expect(first).toBe('result');
    expect(second).toBe('result');
    expect(task).toHaveBeenCalledTimes(1);
    await dedupe('k', task);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('clears the key when the task fails', async () => {
    const dedupe = createDedupe<string>();
    await expect(dedupe('k', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(dedupe('k', async () => 'ok')).resolves.toBe('ok');
  });
});
