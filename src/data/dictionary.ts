import { tonelessKey } from '@/chinese/pinyin/keys';
import { db, type HanziStepDB } from '@/db/db';
import type { DictEntry } from '@/domain/types';
import type { DictRow } from './types';

export const DICT_IMPORT_KEY = 'dictImport';

export interface DictImportState {
  /** sha256 of dict/dict.json.gz from the data manifest. */
  sha256: string;
  count: number;
  importedAt: number;
}

export function dictRowToEntry([s, t, p, en, vi, cl]: DictRow): DictEntry {
  return { s, t, p, pt: tonelessKey(p), en, vi, cl };
}

export async function getDictImportState(database: HanziStepDB = db): Promise<DictImportState | null> {
  const value = (await database.kv.get(DICT_IMPORT_KEY))?.value as Partial<DictImportState> | undefined;
  return value && typeof value.sha256 === 'string' && typeof value.count === 'number'
    ? { sha256: value.sha256, count: value.count, importedAt: value.importedAt ?? 0 }
    : null;
}

/** Entries for an exact simplified (or traditional) headword. */
export async function lookupHeadword(word: string, database: HanziStepDB = db): Promise<DictEntry[]> {
  const simplified = await database.dict.where('s').equals(word).toArray();
  return simplified.length > 0 ? simplified : database.dict.where('t').equals(word).toArray();
}

const HAN_RE = /\p{Script=Han}/u;

/** Search by characters (prefix of simplified or traditional) or by pinyin with or without tones. */
export async function searchDictionary(query: string, limit = 30, database: HanziStepDB = db): Promise<DictEntry[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (HAN_RE.test(trimmed)) {
    const [simplified, traditional] = await Promise.all([
      database.dict.where('s').startsWith(trimmed).limit(300).toArray(),
      database.dict.where('t').startsWith(trimmed).limit(300).toArray(),
    ]);
    const unique = new Map<number | string, DictEntry>();
    for (const entry of [...simplified, ...traditional]) unique.set(entry.id ?? `${entry.s}|${entry.p}`, entry);
    return [...unique.values()]
      .sort((a, b) => Number(b.s === trimmed || b.t === trimmed) - Number(a.s === trimmed || a.t === trimmed) || a.s.length - b.s.length)
      .slice(0, limit);
  }

  const key = tonelessKey(trimmed);
  if (!key) return [];
  const rows = await database.dict.where('pt').startsWith(key).limit(500).toArray();
  return rows
    .sort((a, b) => Number(b.pt === key) - Number(a.pt === key) || a.pt.length - b.pt.length || a.s.length - b.s.length)
    .slice(0, limit);
}
