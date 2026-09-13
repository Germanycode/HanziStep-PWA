/**
 * One-shot Mandarin speech recognition (docs/PLAN.md §8.4).
 *
 * The Web Speech API is not in the DOM types, so the shapes we use are declared
 * here. Chrome and Edge both recognise through their own servers; Firefox has
 * no support at all, which the UI must say out loud.
 */

interface AlternativeLike {
  transcript: string;
  confidence: number;
}

interface ResultLike {
  length: number;
  isFinal: boolean;
  [index: number]: AlternativeLike | undefined;
}

interface ResultListLike {
  length: number;
  [index: number]: ResultLike | undefined;
}

interface RecognitionEventLike {
  results: ResultListLike;
}

interface RecognitionErrorLike {
  error: string;
  message?: string;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => RecognitionLike;

interface RecognitionScope {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
}

function constructorOf(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as RecognitionScope;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type RecognitionEngine = 'chrome' | 'edge' | 'other' | 'none';

export interface RecognitionSupport {
  supported: boolean;
  engine: RecognitionEngine;
  /** null when the browser cannot tell us whether it recognises on device. */
  onDevice: boolean | null;
  /** Vietnamese explanation for the UI. */
  note: string;
}

function engineOf(): RecognitionEngine {
  if (typeof navigator === 'undefined') return 'none';
  const agent = navigator.userAgent;
  if (/Edg\//.test(agent)) return 'edge';
  if (/Chrome\//.test(agent)) return 'chrome';
  return 'other';
}

const ENGINE_NOTES: Record<RecognitionEngine, string> = {
  edge: 'Edge gửi giọng nói tới máy chủ Microsoft để nhận dạng.',
  chrome: 'Chrome gửi giọng nói tới máy chủ Google để nhận dạng.',
  other: 'Trình duyệt này có thể không hỗ trợ nhận dạng giọng nói tiếng Trung.',
  none: 'Trình duyệt này không hỗ trợ nhận dạng giọng nói (Firefox chưa có).',
};

export function recognitionSupport(): RecognitionSupport {
  const supported = constructorOf() !== null;
  const engine = supported ? engineOf() : 'none';
  return { supported, engine, onDevice: null, note: ENGINE_NOTES[engine] };
}

/** Asks the browser whether zh-CN can be recognised on device, when it can answer. */
export async function checkOnDevice(): Promise<boolean | null> {
  const scope = (typeof window === 'undefined' ? {} : window) as unknown as {
    SpeechRecognition?: { available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string | boolean> };
  };
  const available = scope.SpeechRecognition?.available;
  if (typeof available !== 'function') return null;
  try {
    const result = await available({ langs: ['zh-CN'], processLocally: true });
    return typeof result === 'string' ? result === 'available' : Boolean(result);
  } catch {
    return null;
  }
}

export class RecognitionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RecognitionError';
    this.code = code;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Bạn chưa cho phép dùng micro.',
  'service-not-allowed': 'Trình duyệt không cho phép nhận dạng giọng nói.',
  'no-speech': 'Không nghe thấy gì. Thử nói to và rõ hơn.',
  'audio-capture': 'Không tìm thấy micro.',
  network: 'Mất kết nối tới dịch vụ nhận dạng.',
  aborted: 'Đã dừng ghi âm.',
};

export interface ListenOptions {
  lang?: string;
  maxAlternatives?: number;
  /** Stops listening when nothing final has arrived (docs/PLAN.md §8.4: 6s). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Listens for one utterance and returns the alternatives, best first.
 * Resolves with an empty list when the learner said nothing.
 */
export function listenOnce(options: ListenOptions = {}): Promise<string[]> {
  const Recognition = constructorOf();
  if (!Recognition) return Promise.reject(new RecognitionError('unsupported', ENGINE_NOTES.none));

  return new Promise<string[]>((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = options.lang ?? 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = options.maxAlternatives ?? 5;

    let alternatives: string[] = [];
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      action();
    };

    const timer = setTimeout(() => {
      recognition.stop();
    }, options.timeoutMs ?? 6000);

    const onAbort = () => {
      recognition.abort();
      finish(() => resolve([]));
    };
    options.signal?.addEventListener('abort', onAbort);

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (!result) return;
      const found: string[] = [];
      for (let index = 0; index < result.length; index++) {
        const alternative = result[index];
        if (alternative?.transcript) found.push(alternative.transcript);
      }
      alternatives = found;
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        finish(() => resolve(alternatives));
        return;
      }
      finish(() => reject(new RecognitionError(event.error, ERROR_MESSAGES[event.error] ?? `Lỗi nhận dạng: ${event.error}`)));
    };
    recognition.onend = () => finish(() => resolve(alternatives));

    try {
      recognition.start();
    } catch (error) {
      finish(() => reject(new RecognitionError('start-failed', error instanceof Error ? error.message : 'Không bật được micro.')));
    }
  });
}
