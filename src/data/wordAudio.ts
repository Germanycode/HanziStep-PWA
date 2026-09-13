import { cachedLoader, fetchDataJson } from './fetchData';
import { DATA_BASE_URL } from './manifest';

const load = cachedLoader((_: 'index') =>
  fetchDataJson<string[]>(`${DATA_BASE_URL}/words-audio.json`)
    .then((list) => new Set(list))
    .catch(() => new Set<string>()),
);

/** Words that have a real recording (audio-cmn HSK list). Empty when the recordings were not built. */
export function loadWordAudioIndex(): Promise<ReadonlySet<string>> {
  return load('index');
}

export function wordAudioUrl(hanzi: string): string {
  return `/audio/words/${encodeURIComponent(hanzi)}.mp3`;
}
