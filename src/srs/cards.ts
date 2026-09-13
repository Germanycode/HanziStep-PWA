import type { Card, CardState, Facet, Quality } from '@/domain/types';
import type { Scheduler } from './scheduler';
import { sm2 } from './sm2';

export function cardId(facet: Facet, subjectId: string): string {
  return `${facet}:${subjectId}`;
}

export function createCard(
  subjectId: string,
  facet: Facet,
  now: number,
  suspended = false,
  subjectType: Card['subjectType'] = 'word',
): Card {
  const initial = sm2.initial(now);
  return {
    id: cardId(facet, subjectId),
    subjectType,
    subjectId,
    facet,
    state: suspended ? 'suspended' : 'new',
    ...initial,
  };
}

/** Applies one answer. Cards with an interval under a day are learning (or relearning after a lapse). */
export function scheduleCard(card: Card, quality: Quality, now: number, scheduler: Scheduler = sm2): Card {
  const next = scheduler.next(card, quality, now);
  let state: CardState;
  if (next.intervalDays >= 1) state = 'review';
  else if (quality < 3 && (card.state === 'review' || card.state === 'relearning')) state = 'relearning';
  else state = 'learning';
  return { ...card, ...next, state, lastReviewedAt: now };
}

export function isDue(card: Card, now: number): boolean {
  return card.state !== 'suspended' && card.due <= now;
}

export const MASTERY_LABELS = ['Mới', 'Đang học', 'Quen', 'Nhớ', 'Thành thạo'] as const;

export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

export function masteryLevel(repetition: number): MasteryLevel {
  return Math.min(4, Math.max(0, Math.floor(repetition || 0))) as MasteryLevel;
}

export function masteryLabel(repetition: number): string {
  return MASTERY_LABELS[masteryLevel(repetition)];
}

/** Interval in words: "20 phút", "3 ngày", "2 tháng", "1 năm". */
export function intervalLabel(days: number): string {
  if (days < 1) return `${Math.max(1, Math.round(days * 24 * 60))} phút`;
  if (days < 30) return `${Math.round(days)} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${Math.round(days / 365)} năm`;
}
