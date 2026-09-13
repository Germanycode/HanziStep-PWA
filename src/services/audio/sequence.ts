import { syllableAudioKey } from '@/chinese/pinyin/syllables';
import type { Syllable } from '@/chinese/pinyin/types';
import { hasRecording, loadSyllableTable } from '@/data/syllables';
import { playSyllable, type PlayClipOptions } from './clips';

export async function canPlaySyllables(syllables: readonly Syllable[]): Promise<boolean> {
  if (syllables.length === 0) return false;
  try {
    const table = await loadSyllableTable();
    return syllables.every((syllable) => hasRecording(table, syllableAudioKey(syllable.base), syllable.tone));
  } catch {
    return false;
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** Plays recorded syllables one after another (e.g. a tone pair). Throws when a recording is missing. */
export async function playSyllableSequence(
  syllables: readonly Syllable[],
  options: PlayClipOptions & { gapMs?: number } = {},
): Promise<void> {
  const table = await loadSyllableTable();
  for (const [index, syllable] of syllables.entries()) {
    if (options.signal?.aborted) return;
    const key = syllableAudioKey(syllable.base);
    if (!hasRecording(table, key, syllable.tone)) throw new Error(`Chưa có bản ghi cho “${key}${syllable.tone}”.`);
    await playSyllable(key, syllable.tone, options);
    if (index < syllables.length - 1 && options.gapMs) await delay(options.gapMs, options.signal);
  }
}
