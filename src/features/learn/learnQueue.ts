import type { HskWordRecord } from '@/data/types';
import type { Word } from '@/domain/types';
import { wordKey } from '@/features/review/engine/session';

export type LearnCandidate = { kind: 'saved'; word: Word } | { kind: 'hsk'; record: HskWordRecord };

/**
 * Words to introduce next: words the learner saved (oldest first), then the
 * HSK list in order (lower levels first, most frequent first), skipping words
 * already saved, learned or marked known, and entries without any meaning.
 */
export function pickLearnCandidates(
  pending: readonly Word[],
  records: readonly HskWordRecord[],
  existingKeys: ReadonlySet<string>,
  limit: number,
): LearnCandidate[] {
  const result: LearnCandidate[] = pending.slice(0, limit).map((word) => ({ kind: 'saved', word }));
  const taken = new Set(existingKeys);
  for (const record of records) {
    if (result.length >= limit) break;
    const form = record.f[0];
    if (!form || (form.vi.length === 0 && form.en.length === 0)) continue;
    const key = wordKey(record.s, form.pn);
    if (taken.has(key)) continue;
    taken.add(key);
    result.push({ kind: 'hsk', record });
  }
  return result;
}
