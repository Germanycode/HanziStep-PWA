import { base64ToInt16 } from './pcm';

/**
 * Gemini Live session over WebSocket (docs/PLAN.md §8.5).
 *
 * The message shapes live here on purpose: the Live API is still moving, so if
 * the coach ever stops answering, this file is the only place to check against
 * the current documentation.
 */

const ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const INPUT_MIME = 'audio/pcm;rate=16000';
const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

export interface LiveCallbacks {
  onReady?: () => void;
  onAudio?: (pcm: Int16Array) => void;
  /** Transcripts, when the model returns them. */
  onText?: (text: string, role: 'user' | 'model') => void;
  onTurnComplete?: () => void;
  /** The model stopped because the learner started talking. */
  onInterrupted?: () => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export interface LiveOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  callbacks?: LiveCallbacks;
  connectTimeoutMs?: number;
}

interface ServerPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface ServerMessage {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: ServerPart[] };
    turnComplete?: boolean;
    interrupted?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
  };
  error?: { message?: string };
}

export class LiveSession {
  private socket: WebSocket | null = null;
  private ready = false;
  private closedByUs = false;
  private reconnects = 0;

  constructor(private readonly options: LiveOptions) {}

  get connected(): boolean {
    return this.ready && this.socket?.readyState === WebSocket.OPEN;
  }

  connect(signal?: AbortSignal): Promise<void> {
    const key = this.options.apiKey.trim();
    if (!key) return Promise.reject(new Error('Chưa có API key Gemini trong Cài đặt.'));

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(`${ENDPOINT}?key=${encodeURIComponent(key)}`);
      socket.binaryType = 'arraybuffer';
      this.socket = socket;
      this.closedByUs = false;
      const timeout = setTimeout(() => fail(new Error('AI Coach không xác nhận kết nối trong thời gian cho phép.')), this.options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
      const cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.closedByUs = true;
        socket.close();
        reject(error);
      };
      const abort = () => fail(new DOMException('Đã huỷ kết nối AI Coach.', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            setup: {
              model: this.options.model.startsWith('models/') ? this.options.model : `models/${this.options.model}`,
              generationConfig: { responseModalities: ['AUDIO'] },
              systemInstruction: { parts: [{ text: this.options.systemPrompt }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          }),
        );
      };

      socket.onmessage = (event: MessageEvent<unknown>) => {
        void this.handleMessage(event.data).then((isSetup) => {
          if (isSetup && !settled) {
            settled = true;
            cleanup();
            this.ready = true;
            this.options.callbacks?.onReady?.();
            resolve();
          }
        });
      };

      socket.onerror = () => {
        const error = new Error('Mất kết nối tới AI Coach.');
        if (!settled) {
          fail(error);
        } else this.options.callbacks?.onError?.(error);
      };

      socket.onclose = () => {
        this.ready = false;
        if (this.closedByUs) {
          if (!settled) fail(new Error('Kết nối AI Coach đã đóng trước khi sẵn sàng.'));
          this.options.callbacks?.onClose?.();
          return;
        }
        if (!settled) {
          fail(new Error('Kết nối AI Coach đã đóng trước khi sẵn sàng.'));
          this.options.callbacks?.onClose?.();
          return;
        }
        // One quiet retry; after that the UI reports the drop.
        if (settled && this.reconnects === 0) {
          this.reconnects++;
          this.connect(signal).catch((error: unknown) => {
            this.options.callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
            this.options.callbacks?.onClose?.();
          });
          return;
        }
        this.options.callbacks?.onClose?.();
      };
    });
  }

  /** Returns true when this was the setup acknowledgement. */
  private async handleMessage(data: unknown): Promise<boolean> {
    let text: string;
    if (typeof data === 'string') text = data;
    else if (data instanceof Blob) text = await data.text();
    else if (data instanceof ArrayBuffer) text = new TextDecoder().decode(data);
    else return false;

    let message: ServerMessage;
    try {
      message = JSON.parse(text) as ServerMessage;
    } catch {
      return false;
    }

    if (message.error?.message) {
      this.options.callbacks?.onError?.(new Error(message.error.message));
      return false;
    }
    if (message.setupComplete !== undefined) return true;

    const content = message.serverContent;
    if (!content) return false;
    if (content.interrupted) this.options.callbacks?.onInterrupted?.();
    if (content.inputTranscription?.text) this.options.callbacks?.onText?.(content.inputTranscription.text, 'user');
    if (content.outputTranscription?.text) this.options.callbacks?.onText?.(content.outputTranscription.text, 'model');

    for (const part of content.modelTurn?.parts ?? []) {
      if (part.text) this.options.callbacks?.onText?.(part.text, 'model');
      if (part.inlineData?.data) this.options.callbacks?.onAudio?.(base64ToInt16(part.inlineData.data));
    }
    if (content.turnComplete) this.options.callbacks?.onTurnComplete?.();
    return false;
  }

  /** One microphone frame, already 16 kHz PCM16 in base64. */
  sendAudio(base64: string): void {
    if (!this.connected) return;
    this.socket?.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: INPUT_MIME, data: base64 }] } }));
  }

  sendText(text: string): void {
    if (!this.connected) return;
    this.socket?.send(
      JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }),
    );
  }

  close(): void {
    this.closedByUs = true;
    this.ready = false;
    this.socket?.close();
    this.socket = null;
  }
}
