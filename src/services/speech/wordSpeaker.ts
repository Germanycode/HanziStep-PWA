import { useCallback } from 'react';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { loadWordAudioIndex, wordAudioUrl } from '@/data/wordAudio';
import { useSettings } from '@/db/settings';
import { playClip } from '@/services/audio/clips';
import { canPlaySyllables, playSyllableSequence } from '@/services/audio/sequence';
import { speak } from './tts';

export interface SpokenWord {
  simplified: string;
  pinyinNum: string;
}

interface SpeakPreferences {
  rate: number;
  voiceURI?: string;
  slow?: boolean;
  signal?: AbortSignal;
}

/**
 * Plays a word with the best available audio: a single-syllable recording
 * (exact tone) → a recorded HSK word → the zh-CN voice → stitched syllables.
 */
export async function playWord(word: SpokenWord, preferences: SpeakPreferences): Promise<void> {
  const clipRate = preferences.slow ? 0.75 : 1;
  const syllables = parsePinyin(word.pinyinNum).syllables;

  if (syllables.length === 1 && (await canPlaySyllables(syllables))) {
    await playSyllableSequence(syllables, { rate: clipRate, signal: preferences.signal });
    return;
  }
  const recorded = await loadWordAudioIndex();
  if (recorded.has(word.simplified)) {
    try {
      await playClip(wordAudioUrl(word.simplified), { rate: clipRate, signal: preferences.signal });
      return;
    } catch {
      // Fall through to the voice.
    }
  }
  try {
    await speak(word.simplified, {
      rate: (preferences.slow ? 0.7 : 1) * preferences.rate,
      voiceURI: preferences.voiceURI,
      signal: preferences.signal,
    });
  } catch (error) {
    if (await canPlaySyllables(syllables)) {
      await playSyllableSequence(syllables, { rate: clipRate, gapMs: 60, signal: preferences.signal });
      return;
    }
    throw error;
  }
}

/** Word and sentence playback bound to the voice settings. */
export function useWordSpeaker() {
  const { ttsRate, ttsVoiceURI } = useSettings();
  const sayWord = useCallback(
    (word: SpokenWord, slow = false, signal?: AbortSignal) =>
      playWord(word, { rate: ttsRate, voiceURI: ttsVoiceURI || undefined, slow, signal }),
    [ttsRate, ttsVoiceURI],
  );
  const saySentence = useCallback(
    (text: string, slow = false, signal?: AbortSignal) =>
      speak(text, { rate: (slow ? 0.7 : 1) * ttsRate, voiceURI: ttsVoiceURI || undefined, signal }),
    [ttsRate, ttsVoiceURI],
  );
  return { sayWord, saySentence };
}
