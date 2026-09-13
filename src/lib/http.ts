export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${Math.ceil(timeoutMs / 1000)}s`);
    this.name = 'TimeoutError';
  }
}

/** `fetch` with a timeout that also respects a caller-provided abort signal. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (timeoutSignal.aborted && !init.signal?.aborted) throw new TimeoutError(timeoutMs);
    throw error;
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const response = await fetchWithTimeout(input, init, timeoutMs);
  if (!response.ok) throw new HttpError(response.status, `HTTP ${response.status} for ${String(input)}`);
  return (await response.json()) as T;
}
