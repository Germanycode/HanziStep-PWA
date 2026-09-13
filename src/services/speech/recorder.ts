/** Microphone recording and decoding for shadowing (docs/PLAN.md §8.4). */

export interface RecorderSupport {
  supported: boolean;
  note: string;
}

export function recorderSupport(): RecorderSupport {
  const hasMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const hasRecorder = typeof window !== 'undefined' && 'MediaRecorder' in window;
  if (hasMedia && hasRecorder) return { supported: true, note: 'Ghi âm ngay trên máy, không gửi đi đâu cả.' };
  return { supported: false, note: 'Trình duyệt này không ghi âm được (cần MediaRecorder và quyền micro).' };
}

export interface Recording {
  blob: Blob;
  /** Object URL for playback; revoke it when done. */
  url: string;
  durationMs: number;
}

export const MAX_RECORDING_MS = 120_000;
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024;
const STOP_TIMEOUT_MS = 5_000;

/** One take: start, then stop to get the audio back. */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private bytes = 0;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private onLimit: ((error: Error) => void) | null = null;

  get recording(): boolean {
    return this.recorder?.state === 'recording';
  }

  async start(onLimit?: (error: Error) => void): Promise<void> {
    if (this.recording) return;
    const support = recorderSupport();
    if (!support.supported) throw new Error(support.note);
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.bytes = 0;
    this.onLimit = onLimit ?? null;
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.onerror = () => this.abortForLimit(new Error('Máy ghi âm gặp lỗi.'));
    this.recorder.ondataavailable = (event) => {
      if (event.data.size <= 0) return;
      this.bytes += event.data.size;
      if (this.bytes > MAX_RECORDING_BYTES) {
        this.abortForLimit(new Error('Bản ghi vượt quá 8 MB. Hãy ghi một đoạn ngắn hơn.'));
        return;
      }
      this.chunks.push(event.data);
    };
    this.startedAt = Date.now();
    this.recorder.start(1_000);
    this.limitTimer = setTimeout(
      () => this.abortForLimit(new Error('Bản ghi đã đạt giới hạn 2 phút. Hãy thử lại với đoạn ngắn hơn.')),
      MAX_RECORDING_MS,
    );
  }

  stop(): Promise<Recording> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') return Promise.reject(new Error('Chưa bắt đầu ghi âm.'));
    return new Promise<Recording>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.release();
        reject(new Error('Máy ghi âm không phản hồi khi dừng.'));
      }, STOP_TIMEOUT_MS);
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.release();
        reject(error);
      };
      recorder.onerror = () => fail(new Error('Máy ghi âm gặp lỗi.'));
      recorder.onstop = () => {
        if (settled) return;
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > MAX_RECORDING_BYTES) {
          fail(new Error('Bản ghi vượt quá 8 MB. Hãy ghi một đoạn ngắn hơn.'));
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.release();
        resolve({ blob, url: URL.createObjectURL(blob), durationMs: Date.now() - this.startedAt });
      };
      try {
        recorder.stop();
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.release();
  }

  private release(): void {
    if (this.limitTimer) clearTimeout(this.limitTimer);
    this.limitTimer = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.recorder = null;
    this.onLimit = null;
  }

  private abortForLimit(error: Error): void {
    const notify = this.onLimit;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      try {
        this.recorder.stop();
      } catch {
        // The stream is released below even if the recorder changed state first.
      }
    }
    this.release();
    notify?.(error);
  }
}

let audioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}

/** Mono samples of a clip, for the pitch curve. */
export async function decodeToMono(source: Blob | ArrayBuffer): Promise<{ samples: Float32Array; sampleRate: number }> {
  const buffer = source instanceof Blob ? await source.arrayBuffer() : source;
  const decoded = await getAudioContext().decodeAudioData(buffer.slice(0));
  const channel = decoded.getChannelData(0);
  return { samples: new Float32Array(channel), sampleRate: decoded.sampleRate };
}

/** Base64 payload of a recording, for sending to an AI service. */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (blob.size > MAX_RECORDING_BYTES) throw new Error('Bản ghi vượt quá 8 MB.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được bản ghi âm.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('Không mã hoá được bản ghi âm.'));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Loads a recording that ships with the app (syllable or word audio). */
export async function loadAudioSamples(url: string): Promise<{ samples: Float32Array; sampleRate: number }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được âm thanh mẫu (HTTP ${response.status}).`);
  return decodeToMono(await response.arrayBuffer());
}
