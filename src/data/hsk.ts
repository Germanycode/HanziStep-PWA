import { cachedLoader, fetchDataJson } from './fetchData';
import { DATA_BASE_URL } from './manifest';
import type { HskLevelFile, HskTrackKey, HskWordRecord } from './types';

export const MAX_LEVEL: Record<HskTrackKey, number> = { hsk2: 6, hsk3: 7, 'hsk3-newest': 7 };
/** Generated level-one file sizes; update together with a deliberate data-pack revision. */
export const HSK_LEVEL_ONE_COUNTS: Record<HskTrackKey, number> = { hsk2: 150, hsk3: 506, 'hsk3-newest': 294 };

export const TRACK_LABELS: Record<HskTrackKey, string> = {
  hsk3: 'HSK 3.0',
  'hsk3-newest': 'HSK 3.0 (mới nhất)',
  hsk2: 'HSK 2.0',
};

const LEVEL_FIELD: Record<HskTrackKey, keyof HskWordRecord['lv']> = {
  hsk2: 'hsk2',
  hsk3: 'hsk3',
  'hsk3-newest': 'hsk3Newest',
};

export function levelOf(levels: HskWordRecord['lv'], track: HskTrackKey): number | undefined {
  return levels[LEVEL_FIELD[track]];
}

export function levelLabel(level: number): string {
  return level >= 7 ? 'Bậc 7–9' : `Cấp ${level}`;
}

const loadLevel = cachedLoader((key: string) => fetchDataJson<HskLevelFile>(`${DATA_BASE_URL}/hsk/${key}.json`));

export function loadHskLevel(track: HskTrackKey, level: number): Promise<HskLevelFile> {
  return loadLevel(`${track}-${level}`);
}

/** Words of levels 1…level, lower levels first, each level in frequency order. */
export async function loadHskUpTo(track: HskTrackKey, level: number): Promise<HskWordRecord[]> {
  const top = Math.min(level, MAX_LEVEL[track]);
  const files = await Promise.all(Array.from({ length: top }, (_, index) => loadHskLevel(track, index + 1)));
  return files.flatMap((file) => file.words);
}

const indexCache = new Map<HskTrackKey, Promise<Map<string, number>>>();

/** Characters → HSK level for a whole track, used by the reader popover. */
export function loadHskIndex(track: HskTrackKey): Promise<Map<string, number>> {
  let cached = indexCache.get(track);
  if (!cached) {
    cached = loadHskUpTo(track, MAX_LEVEL[track])
      .then((words) => {
        const index = new Map<string, number>();
        for (const record of words) {
          const level = levelOf(record.lv, track);
          if (level !== undefined && !index.has(record.s)) index.set(record.s, level);
        }
        return index;
      })
      .catch((error: unknown) => {
        indexCache.delete(track);
        throw error;
      });
    indexCache.set(track, cached);
  }
  return cached;
}
