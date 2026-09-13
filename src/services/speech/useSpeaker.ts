import { useCallback } from 'react';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { useSettings } from '@/db/settings';
import { canPlaySyllables, playSyllableSequence } from '@/services/audio/sequence';
import { speak } from './tts';

export interface SayOptions {
  /** Characters to read with text-to-speech. */
  hanzi?: string;
  /** Pinyin to play from syllable recordings when every syllable has one. */
  pinyin?: string;
  slow?: boolean;
}

/**
 * Plays real recordings when possible (exact tones, no polyphone mistakes)
 * and falls back to the Chinese TTS voice for the characters.
 */
export function useSpeaker() {
  const { ttsRate, ttsVoiceURI } = useSettings();
  return useCallback(
    async ({ hanzi, pinyin, slow = false }: SayOptions) => {
      if (pinyin) {
        const { syllables, errors } = parsePinyin(pinyin);
        if (errors.length === 0 && (await canPlaySyllables(syllables))) {
          await playSyllableSequence(syllables, { rate: slow ? 0.75 : 1, gapMs: 120 });
          return;
        }
      }
      if (!hanzi) throw new Error('Chưa có bản ghi cho âm này.');
      await speak(hanzi, { rate: (slow ? 0.7 : 1) * ttsRate, voiceURI: ttsVoiceURI || undefined });
    },
    [ttsRate, ttsVoiceURI],
  );
}
