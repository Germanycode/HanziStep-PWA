import { db, type HanziStepDB } from '@/db/db';
import type { ComprehensionQuestion, TextDoc } from '@/domain/types';
import { applyActivity, evaluateBadges, type ActivityResult } from '@/progress/recordActivity';
import { imageCacheKey } from '@/services/images/store';

export interface NewTextInput {
  kind: TextDoc['kind'];
  title: string;
  titleVi?: string;
  level?: number;
  genre?: string;
  sentences: TextDoc['sentences'];
  targetWordIds?: string[];
  questions?: ComprehensionQuestion[];
  coverage?: number;
  imageUrl?: string;
}

export async function createText(input: NewTextInput, database: HanziStepDB = db): Promise<TextDoc> {
  const doc: TextDoc = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    titleVi: input.titleVi,
    level: input.level,
    genre: input.genre,
    sentences: input.sentences,
    targetWordIds: input.targetWordIds ?? [],
    questions: input.questions ?? [],
    segOverrides: {},
    progress: { sentenceIndex: 0 },
    coverage: input.coverage,
    imageUrl: input.imageUrl,
    createdAt: Date.now(),
  };
  await database.texts.add(doc);
  return doc;
}

export function getText(id: string, database: HanziStepDB = db): Promise<TextDoc | undefined> {
  return database.texts.get(id);
}

export function listTexts(database: HanziStepDB = db): Promise<TextDoc[]> {
  return database.texts.orderBy('createdAt').reverse().toArray();
}

/** Records when a learner really entered the reader/listener, without resetting an older start. */
export async function markTextOpened(id: string, now = Date.now(), database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', database.texts, async () => {
    const doc = await database.texts.get(id);
    if (!doc || doc.progress.openedAt) return;
    await database.texts.put({ ...doc, progress: { ...doc.progress, openedAt: now } });
  });
}

export async function deleteText(id: string, database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', [database.texts, database.caches], async () => {
    await database.texts.delete(id);
    await database.caches.delete(imageCacheKey(id));
  });
}

export async function setReadingPosition(id: string, sentenceIndex: number, database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', database.texts, async () => {
    const doc = await database.texts.get(id);
    if (!doc || doc.progress.sentenceIndex === sentenceIndex) return;
    await database.texts.put({ ...doc, progress: { ...doc.progress, sentenceIndex } });
  });
}

/** Stores the recomputed coverage so the library can show it without re-reading the text. */
export async function setCoverage(id: string, coverage: number, database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', database.texts, async () => {
    const doc = await database.texts.get(id);
    if (!doc || doc.coverage === coverage) return;
    await database.texts.put({ ...doc, coverage });
  });
}

function withoutOverlap(spans: readonly [number, number][], span: [number, number]): [number, number][] {
  return spans.filter(([start, end]) => end <= span[0] || start >= span[1]);
}

/** Adds one split/merge span for a sentence, dropping any span it overlaps. */
export async function addSegmentOverride(
  id: string,
  sentenceIndex: number,
  span: [number, number],
  database: HanziStepDB = db,
): Promise<void> {
  await database.transaction('rw', database.texts, async () => {
    const doc = await database.texts.get(id);
    if (!doc) return;
    const current = doc.segOverrides[sentenceIndex] ?? [];
    const next = [...withoutOverlap(current, span), span].sort((a, b) => a[0] - b[0]);
    await database.texts.put({ ...doc, segOverrides: { ...doc.segOverrides, [sentenceIndex]: next } });
  });
}

export async function clearSegmentOverrides(id: string, sentenceIndex: number, database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', database.texts, async () => {
    const doc = await database.texts.get(id);
    if (!doc) return;
    const { [sentenceIndex]: _removed, ...rest } = doc.segOverrides;
    await database.texts.put({ ...doc, segOverrides: rest });
  });
}

/** Marks a text finished only after meaningful progress; XP is given once per text. */
export async function completeText(
  id: string,
  mode: 'read' | 'listen',
  database: HanziStepDB = db,
  now = Date.now(),
): Promise<ActivityResult | null> {
  const result = await database.transaction('rw', [database.texts, database.dailyStats, database.kv], async () => {
    const doc = await database.texts.get(id);
    if (!doc) throw new Error('Không tìm thấy bài học.');
    if (doc.progress.completedAt) return null;
    const lastSentence = Math.max(0, doc.sentences.length - 1);
    if (doc.progress.sentenceIndex < lastSentence) {
      throw new Error('Hãy đọc hoặc nghe tới câu cuối trước khi hoàn thành.');
    }
    if (!doc.progress.openedAt || now - doc.progress.openedAt < 60_000) {
      throw new Error('Hãy dành ít nhất 1 phút cho bài trước khi hoàn thành.');
    }
    await database.texts.put({ ...doc, progress: { ...doc.progress, completedAt: now } });
    return applyActivity(database, {
      kind: 'text-read',
      counters: mode === 'read' ? { textsRead: 1 } : undefined,
      now: new Date(now),
    });
  });
  if (!result) return null;
  return { ...result, newBadges: await evaluateBadges(database, new Date(now)) };
}

/** Grants at most three comprehension rewards for each text, durably and atomically. */
export async function rewardComprehension(
  textId: string,
  questionIndex: number,
  database: HanziStepDB = db,
  now = Date.now(),
): Promise<ActivityResult | null> {
  const result = await database.transaction('rw', [database.texts, database.dailyStats, database.kv], async () => {
    const doc = await database.texts.get(textId);
    if (!doc || questionIndex < 0 || questionIndex >= doc.questions.length) return null;
    const answered = [...new Set(doc.progress.comprehensionDone ?? [])];
    if (answered.includes(questionIndex) || answered.length >= 3) return null;
    answered.push(questionIndex);
    await database.texts.put({ ...doc, progress: { ...doc.progress, comprehensionDone: answered } });
    return applyActivity(database, { kind: 'comprehension', now: new Date(now) });
  });
  if (!result) return null;
  return { ...result, newBadges: await evaluateBadges(database, new Date(now)) };
}
