/** Mandarin text-to-speech voice selection (pure functions, unit-tested). */

export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace(/_/g, '-');
}

/**
 * Higher is better; negative means unusable. zh-HK voices speak Cantonese, so
 * they are excluded. Edge's online "Natural" voices (Xiaoxiao, Yunxi) sound
 * best, then Google 普通话, then the desktop Microsoft voices.
 */
export function scoreVoice(voice: VoiceInfo): number {
  const lang = normalizeLang(voice.lang);
  const name = voice.name.toLowerCase();
  if (lang.startsWith('zh-hk') || lang.startsWith('yue') || /cantonese|粤|粵/.test(name)) return -1;

  let score: number;
  if (lang === 'zh-cn' || lang.startsWith('cmn') || lang === 'zh-hans-cn' || lang === 'zh-hans') score = 100;
  else if (lang.startsWith('zh-tw') || lang === 'zh') score = 50;
  else return -1;

  if (/natural|neural|online/.test(name)) score += 30;
  if (/google/.test(name)) score += 20;
  if (/xiaoxiao|yunxi|xiaoyi|yunjian|yunyang/.test(name)) score += 5;
  if (/huihui|kangkang|yaoyao/.test(name)) score += 2;
  return score;
}

export function rankChineseVoices(voices: readonly VoiceInfo[]): VoiceInfo[] {
  return voices
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name))
    .map(({ voice }) => voice);
}

/** The saved voice when it is still installed, otherwise the best-ranked one. */
export function pickVoice(voices: readonly VoiceInfo[], preferredURI?: string): VoiceInfo | undefined {
  const ranked = rankChineseVoices(voices);
  return ranked.find((voice) => voice.voiceURI === preferredURI) ?? ranked[0];
}

/**
 * Splits text into sentence-sized chunks. Chrome's network voices stop
 * speaking long utterances after roughly 15 seconds, so each chunk is spoken
 * separately.
 */
export function splitIntoSpeechChunks(text: string, maxLength = 80): string[] {
  const pieces = text
    .split(/(?<=[。！？!?；;\n])/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const piece of pieces) {
    if (piece.length > maxLength) {
      // Very long sentences: break at commas, then hard-split.
      for (const part of piece.split(/(?<=[，,、])/)) {
        for (let start = 0; start < part.length; start += maxLength) chunks.push(part.slice(start, start + maxLength));
      }
      continue;
    }
    const last = chunks[chunks.length - 1];
    if (last !== undefined && last.length + piece.length <= maxLength) chunks[chunks.length - 1] = last + piece;
    else chunks.push(piece);
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}
