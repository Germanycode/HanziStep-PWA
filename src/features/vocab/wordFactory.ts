import { isCognate } from '@/chinese/cognate';
import { hanvietReading, type HanvietData } from '@/chinese/hanviet';
import type { HskWordRecord } from '@/data/types';
import type { DictEntry, Word, WordSource } from '@/domain/types';

const MAX_MEANINGS = 6;

export function cleanMeanings(meanings: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const meaning of meanings) {
    const trimmed = meaning.replace(/\s+/g, ' ').trim();
    const key = trimmed.toLocaleLowerCase('vi');
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_MEANINGS) break;
  }
  return result;
}

function baseWord(now: number): Pick<Word, 'id' | 'pinyinVariants' | 'examples' | 'imageStatus' | 'tags' | 'createdAt' | 'updatedAt'> {
  return { id: crypto.randomUUID(), pinyinVariants: [], examples: [], imageStatus: 'none', tags: [], createdAt: now, updatedAt: now };
}

/** A Word from an HSK list record (one pronunciation form). */
export function wordFromHskRecord(record: HskWordRecord, now: number, formIndex = 0): Word {
  const form = record.f[formIndex] ?? record.f[0];
  if (!form) throw new Error(`HSK record ${record.s} has no forms`);
  const meaningVi = cleanMeanings(form.vi);
  return {
    ...baseWord(now),
    simplified: record.s,
    traditional: form.t !== record.s ? form.t : undefined,
    pinyinNum: form.pn,
    hanViet: form.hv,
    meaningVi,
    meaningEn: cleanMeanings(form.en),
    pos: [...record.pos],
    classifiers: [...form.cl],
    hsk: { ...record.lv },
    freqRank: record.q,
    radical: record.r,
    cognate: isCognate(form.hv, meaningVi),
    source: 'hsk-list',
  };
}

/** A Word from a CC-CEDICT/CVDICT entry (words outside the HSK lists). */
export function wordFromDictEntry(entry: DictEntry, hanviet: HanvietData | null, now: number, source: WordSource = 'manual'): Word {
  const meaningVi = cleanMeanings(entry.vi);
  const hanViet = hanviet ? hanvietReading(hanviet, entry.t, entry.p, { context: meaningVi.join('; ') }).best : '';
  return {
    ...baseWord(now),
    simplified: entry.s,
    traditional: entry.t !== entry.s ? entry.t : undefined,
    pinyinNum: entry.p,
    hanViet,
    meaningVi,
    meaningEn: cleanMeanings(entry.en),
    pos: [],
    classifiers: [...entry.cl],
    hsk: {},
    cognate: isCognate(hanViet, meaningVi),
    source,
  };
}

/** Vietnamese labels for the part-of-speech codes used by the HSK lists. */
export const POS_LABELS: Record<string, string> = {
  n: 'danh từ',
  nr: 'tên người',
  ns: 'địa danh',
  nz: 'danh từ riêng',
  t: 'từ chỉ thời gian',
  s: 'từ chỉ nơi chốn',
  f: 'phương vị từ',
  v: 'động từ',
  vn: 'động danh từ',
  vd: 'động từ',
  a: 'tính từ',
  ad: 'tính từ',
  an: 'tính từ',
  b: 'tính từ',
  z: 'từ tượng thái',
  d: 'phó từ',
  m: 'số từ',
  q: 'lượng từ',
  r: 'đại từ',
  p: 'giới từ',
  c: 'liên từ',
  u: 'trợ từ',
  y: 'trợ từ ngữ khí',
  e: 'thán từ',
  o: 'từ tượng thanh',
  i: 'thành ngữ',
  l: 'cụm cố định',
};

export function posLabel(code: string): string {
  return POS_LABELS[code] ?? code;
}
