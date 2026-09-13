import { levelOf } from '@/data/hsk';
import type { HskTrackKey, HskWordRecord } from '@/data/types';
import type { Word } from '@/domain/types';
import type { DistractorCandidate } from './distractors';
import { wordKey } from './session';

export function wordToCandidate(word: Word, track: HskTrackKey): DistractorCandidate {
  return {
    id: word.id,
    simplified: word.simplified,
    pinyinNum: word.pinyinNum,
    meaningVi: word.meaningVi,
    pos: word.pos,
    hskLevel: levelOf(word.hsk, track),
  };
}

export function recordToCandidate(record: HskWordRecord, track: HskTrackKey): DistractorCandidate | null {
  const form = record.f[0];
  if (!form || form.vi.length === 0) return null;
  return {
    id: `hsk:${wordKey(record.s, form.pn)}`,
    simplified: record.s,
    pinyinNum: form.pn,
    meaningVi: form.vi,
    pos: record.pos,
    hskLevel: levelOf(record.lv, track),
  };
}

/** Distractor pool: saved words first, then HSK list words not already saved. */
export function buildCandidatePool(words: readonly Word[], records: readonly HskWordRecord[], track: HskTrackKey): DistractorCandidate[] {
  const pool = words.map((word) => wordToCandidate(word, track));
  const seen = new Set(words.map((word) => wordKey(word.simplified, word.pinyinNum)));
  for (const record of records) {
    const candidate = recordToCandidate(record, track);
    if (!candidate) continue;
    const key = wordKey(candidate.simplified, candidate.pinyinNum);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(candidate);
  }
  return pool;
}
