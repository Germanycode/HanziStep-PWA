import type { Card, Facet, Word } from '@/domain/types';
import { DAY_MS } from '@/srs/scheduler';

export interface SessionItem {
  cardId: string;
  subjectId: string;
  facet: Facet;
}

export interface ReviewPlanInput {
  cards: readonly Card[];
  words: ReadonlyMap<string, Word>;
  now: number;
  /** Review answers already given today (counts against the daily cap). */
  reviewedToday: number;
  maxReviewsPerDay: number;
  tag?: string;
}

export interface ReviewPlan {
  items: SessionItem[];
  /** Due items after burying siblings (before the daily cap). */
  dueCount: number;
  /** Due items beyond today's cap. */
  backlog: number;
  /** Review slots left today after answers already recorded. */
  remainingCapacity: number;
  /** Earliest due time of a card that is not due yet. */
  nextDueAt: number | null;
}

/** Twenty minutes, so brand-new intervals don't dominate the overdue ratio. */
const MIN_PRIORITY_INTERVAL_DAYS = 1 / 72;

export function overdueRatio(card: Card, now: number): number {
  return (now - card.due) / (Math.max(card.intervalDays, MIN_PRIORITY_INTERVAL_DAYS) * DAY_MS);
}

/**
 * Builds today's review queue (docs/PLAN.md §5.6):
 * 1. due, non-suspended cards of words still being learned (optionally with a tag);
 * 2. cards in the 20-minute step first (oldest due first), then the rest by how overdue they are;
 * 3. at most one facet per word per session (siblings are buried);
 * 4. capped by the daily review limit; the rest is backlog.
 */
export function buildReviewPlan(input: ReviewPlanInput): ReviewPlan {
  const eligible = input.cards.filter((card) => {
    if (card.state === 'suspended') return false;
    const word = input.words.get(card.subjectId);
    if (!word || word.knownWithoutSrs) return false;
    return !input.tag || word.tags.includes(input.tag);
  });

  const due = eligible.filter((card) => card.due <= input.now);
  const learning = due.filter((card) => card.intervalDays < 1).sort((a, b) => a.due - b.due);
  const mature = due
    .filter((card) => card.intervalDays >= 1)
    .sort((a, b) => overdueRatio(b, input.now) - overdueRatio(a, input.now));

  const seenWords = new Set<string>();
  const ordered: SessionItem[] = [];
  for (const card of [...learning, ...mature]) {
    if (seenWords.has(card.subjectId)) continue;
    seenWords.add(card.subjectId);
    ordered.push({ cardId: card.id, subjectId: card.subjectId, facet: card.facet });
  }

  const allowance = Math.max(0, input.maxReviewsPerDay - input.reviewedToday);
  const items = ordered.slice(0, allowance);
  let nextDueAt: number | null = null;
  for (const card of eligible) {
    if (card.due > input.now && (nextDueAt === null || card.due < nextDueAt)) nextDueAt = card.due;
  }

  return { items, dueCount: ordered.length, backlog: ordered.length - items.length, remainingCapacity: allowance, nextDueAt };
}

export function remainingNewWords(newWordsPerDay: number, introducedToday: number, extraToday = 0): number {
  return Math.max(0, newWordsPerDay + extraToday - introducedToday);
}

export function wordKey(simplified: string, pinyinNum: string): string {
  return `${simplified}|${pinyinNum.toLowerCase()}`;
}

/** +30 XP needs a real session: at least 10 answers, or an emptied queue with at least 5 (fixes the English app's +30 after one answer). */
export function sessionCompleteEligible(answers: number, queueEmptied: boolean): boolean {
  return answers >= 10 || (queueEmptied && answers >= 5);
}

/**
 * Words in a matching question that are also due `read` cards later in the
 * queue: matching them counts as their review (docs/PLAN.md §5.7).
 */
export function matchBonusItems(queue: readonly SessionItem[], currentIndex: number, wordIds: readonly string[]): SessionItem[] {
  return queue.filter((item, index) => index > currentIndex && item.facet === 'read' && wordIds.includes(item.subjectId));
}
