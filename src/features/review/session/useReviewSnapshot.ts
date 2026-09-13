import { useLiveQuery } from 'dexie-react-hooks';
import { db, type HanziStepDB } from '@/db/db';
import { getSettings } from '@/db/settings';
import type { Facet, Word } from '@/domain/types';
import { toDayKey } from '@/lib/dayKey';
import { useNow } from '@/lib/useNow';
import { masteryLabel } from '@/srs/cards';
import { buildReviewPlan, remainingNewWords } from '../engine/session';

export interface DuePreviewItem {
  wordId: string;
  simplified: string;
  pinyinNum: string;
  facet: Facet;
  mastery: string;
}

export interface ReviewSnapshot {
  dueCount: number;
  availableCount: number;
  backlog: number;
  remainingCapacity: number;
  nextDueAt: number | null;
  /** New words still allowed today. */
  newRemaining: number;
  /** Words waiting to be learned (saved from lookup or reading). */
  pendingCount: number;
  tags: string[];
  preview: DuePreviewItem[];
  totalCards: number;
}

const PREVIEW_SIZE = 12;

/** Due counts for the gate, the Today page and the sidebar. */
export async function loadReviewSnapshot(tag?: string, now = Date.now(), database: HanziStepDB = db): Promise<ReviewSnapshot> {
  const settings = await getSettings(database);
  const [words, cards, stats] = await Promise.all([
    database.words.toArray(),
    database.cards.toArray(),
    database.dailyStats.get(toDayKey(new Date(now), settings.dayStartHour)),
  ]);
  const wordCards = cards.filter((card) => card.subjectType === 'word');
  const wordMap = new Map<string, Word>(words.map((word) => [word.id, word]));
  const plan = buildReviewPlan({
    cards: wordCards,
    words: wordMap,
    now,
    reviewedToday: stats?.answers ?? 0,
    maxReviewsPerDay: settings.maxReviewsPerDay,
    tag,
  });

  const withCards = new Set(wordCards.map((card) => card.subjectId));
  const tags = [...new Set(words.filter((word) => withCards.has(word.id)).flatMap((word) => word.tags))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
  const cardById = new Map(wordCards.map((card) => [card.id, card]));

  return {
    dueCount: plan.dueCount,
    availableCount: plan.items.length,
    backlog: plan.backlog,
    remainingCapacity: plan.remainingCapacity,
    nextDueAt: plan.nextDueAt,
    newRemaining: remainingNewWords(settings.newWordsPerDay, stats?.newIntroduced ?? 0),
    pendingCount: words.filter((word) => !word.knownWithoutSrs && !withCards.has(word.id)).length,
    tags,
    totalCards: wordCards.length,
    preview: plan.items.slice(0, PREVIEW_SIZE).flatMap((item) => {
      const word = wordMap.get(item.subjectId);
      if (!word) return [];
      return [
        {
          wordId: word.id,
          simplified: word.simplified,
          pinyinNum: word.pinyinNum,
          facet: item.facet,
          mastery: masteryLabel(cardById.get(item.cardId)?.repetition ?? 0),
        },
      ];
    }),
  };
}

export function useReviewSnapshot(tag?: string): ReviewSnapshot | undefined {
  const now = useNow();
  return useLiveQuery(() => loadReviewSnapshot(tag, now), [tag, now]);
}

/**
 * Just the number of words waiting, for the app badge.
 *
 * This one runs on every database change anywhere in the app, so it must stay
 * cheap: it reads only the cards that are actually due (indexed) and then looks
 * up exactly those words, instead of scanning both tables like the full
 * snapshot. Same rule as a session: one facet per word.
 */
export async function loadDueCount(now = Date.now(), database: HanziStepDB = db): Promise<number> {
  const due = (await database.cards.where('due').belowOrEqual(now).toArray()).filter((card) => card.state !== 'suspended');
  if (due.length === 0) return 0;

  const subjectIds = [...new Set(due.map((card) => card.subjectId))];
  const words = await database.words.bulkGet(subjectIds);
  const learnable = new Set(words.flatMap((word) => (word && !word.knownWithoutSrs ? [word.id] : [])));
  return subjectIds.filter((id) => learnable.has(id)).length;
}

export function useDueCount(): number | undefined {
  const now = useNow();
  return useLiveQuery(() => loadDueCount(now), [now]);
}
