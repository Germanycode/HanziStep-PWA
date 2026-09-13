import { DATA_BASE_URL } from './manifest';
import type { SyllableInfo } from './types';

export type SyllableTable = ReadonlyMap<string, SyllableInfo>;

let tablePromise: Promise<SyllableTable> | null = null;

/** Loads syllables.json once (keys use "v" for ü). */
export function loadSyllableTable(): Promise<SyllableTable> {
  tablePromise ??= fetch(`${DATA_BASE_URL}/syllables.json`)
    .then(async (response) => {
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
        throw new Error('Chưa có bảng âm tiết. Hãy build gói dữ liệu (npm run data:build).');
      }
      const list = (await response.json()) as SyllableInfo[];
      return new Map(list.map((info) => [info.key, info]));
    })
    .catch((error: unknown) => {
      tablePromise = null;
      throw error;
    });
  return tablePromise;
}

export function hasRecording(table: SyllableTable, key: string, tone: number): boolean {
  return table.get(key)?.tones.includes(tone) ?? false;
}
