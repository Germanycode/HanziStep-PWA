import { containsWordToken } from '@/chinese/text';
import { cachedLoader, fetchDataJson } from './fetchData';
import { DATA_BASE_URL } from './manifest';
import type { SentenceRecord } from './types';

const loadLevel = cachedLoader((level: number) => fetchDataJson<SentenceRecord[]>(`${DATA_BASE_URL}/sentences/${level}.json`));

export function loadSentences(level: number): Promise<SentenceRecord[]> {
  return loadLevel(level);
}

/**
 * Short Tatoeba sentences that use `word`, from easy levels up to one level
 * above the word. Whole segmented words are preferred over substrings.
 */
export async function findExampleSentences(word: string, wordLevel = 1, limit = 3): Promise<SentenceRecord[]> {
  const top = Math.min(6, Math.max(1, wordLevel + 1));
  const lists = await Promise.all(
    Array.from({ length: top }, (_, index) => loadSentences(index + 1).catch((): SentenceRecord[] => [])),
  );
  const matches = lists.flat().filter((sentence) => sentence.zh.includes(word));
  const whole = matches.filter((sentence) => containsWordToken(sentence.zh, word));
  return (whole.length > 0 ? whole : matches).sort((a, b) => a.zh.length - b.zh.length).slice(0, limit);
}
