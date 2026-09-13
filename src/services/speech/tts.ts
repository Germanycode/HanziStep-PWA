import { duckMusic, unduckMusic } from '@/services/audio/mixer';
import { pickVoice, rankChineseVoices, splitIntoSpeechChunks, type VoiceInfo } from './voices';

export interface SpeakOptions {
  /** 0.5–1.5; 1 is normal speed. */
  rate?: number;
  voiceURI?: string;
  signal?: AbortSignal;
}

export class SpeechUnavailableError extends Error {
  constructor(message = 'Máy chưa có giọng đọc tiếng Trung (zh-CN).') {
    super(message);
    this.name = 'SpeechUnavailableError';
  }
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function toVoiceInfo(voice: SpeechSynthesisVoice): VoiceInfo {
  return {
    voiceURI: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    default: voice.default,
  };
}

/** Chrome fills the voice list asynchronously, so wait for `voiceschanged` (briefly). */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const current = synth.getVoices();
  if (current.length > 0) return Promise.resolve(current);
  return new Promise((resolve) => {
    const finish = () => {
      synth.removeEventListener('voiceschanged', finish);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener('voiceschanged', finish);
  });
}

export async function listChineseVoices(): Promise<VoiceInfo[]> {
  return rankChineseVoices((await loadVoices()).map(toVoiceInfo));
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  unduckMusic('tts');
}

function speakChunk(synth: SpeechSynthesis, text: string, voice: SpeechSynthesisVoice, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      // "interrupted"/"canceled" happen when something else starts speaking; treat as a normal stop.
      if (event.error === 'interrupted' || event.error === 'canceled') resolve();
      else reject(new Error(`Speech failed: ${event.error}`));
    };
    synth.speak(utterance);
  });
}

/**
 * Speaks Mandarin text sentence by sentence with the best zh-CN voice (or the
 * saved one). Background music is ducked while speaking.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (!isSpeechSynthesisSupported()) throw new SpeechUnavailableError('Trình duyệt không hỗ trợ đọc văn bản.');
  const synth = window.speechSynthesis;
  const voices = await loadVoices();
  const chosen = pickVoice(voices.map(toVoiceInfo), options.voiceURI);
  const voice = chosen && voices.find((item) => item.voiceURI === chosen.voiceURI);
  if (!voice) throw new SpeechUnavailableError();

  const rate = Math.min(1.5, Math.max(0.5, options.rate ?? 1));
  synth.cancel();
  duckMusic('tts');
  const onAbort = () => synth.cancel();
  options.signal?.addEventListener('abort', onAbort);
  try {
    for (const chunk of splitIntoSpeechChunks(text)) {
      if (options.signal?.aborted) break;
      await speakChunk(synth, chunk, voice, rate);
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    unduckMusic('tts');
  }
}
