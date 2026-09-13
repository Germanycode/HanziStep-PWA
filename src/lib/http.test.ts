import { describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchWithTimeout, HttpError, TimeoutError } from './http';

function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
  );
}

describe('fetchWithTimeout', () => {
  it('throws TimeoutError when the request takes too long', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    await expect(fetchWithTimeout('https://example.test', {}, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('passes through a caller abort instead of reporting a timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const request = fetchWithTimeout('https://example.test', { signal: controller.signal }, 5_000);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchJson', () => {
  it('parses JSON on success and raises HttpError otherwise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/ok')
          ? new Response(JSON.stringify({ hello: '你好' }), { status: 200 })
          : new Response('missing', { status: 404 }),
      ),
    );
    await expect(fetchJson<{ hello: string }>('https://example.test/ok')).resolves.toEqual({ hello: '你好' });
    const failure = fetchJson('https://example.test/missing');
    await expect(failure).rejects.toBeInstanceOf(HttpError);
    await expect(failure).rejects.toMatchObject({ status: 404 });
  });
});
