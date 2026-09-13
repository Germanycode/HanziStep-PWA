import { db, type HanziStepDB } from '@/db/db';
import { normalizeSettings, SETTINGS_KEY } from '@/db/settings';
import type { Card, Facet, Quality, ReviewLog, SchedSnapshot } from '@/domain/types';
import { toDayKey } from '@/lib/dayKey';
import { applyActivity, evaluateBadges, recordActivity, type ActivityResult, type AppliedActivity } from '@/progress/recordActivity';
import { cardId, createCard, scheduleCard } from '@/srs/cards';
import { toRating } from '@/srs/scheduler';
import { schedulerFor } from '@/srs/schedulers';
import { storedSchedule } from '@/srs/switchScheduler';
import { qualityFor, type AnswerSignal } from './quality';
import { sessionCompleteEligible } from './session';
import { characterFromWord, hanCharacters, mergeCharacter } from '@/features/writing/characters';

export interface AnswerCardInput {
  cardId: string;
  /**
   * learn: first check right after the introduction (+5 XP, counts as a new word);
   * review: normal answer (+15/+5 XP);
   * retry: practice on mistakes — never changes the schedule (+3 XP when right);
   * match-bonus: another due word matched inside a matching question (schedule only).
   */
  mode: ReviewLog['mode'];
  signal: AnswerSignal;
  now?: Date;
}

export interface AnswerCardResult {
  quality: Quality;
  card: Card;
  log: ReviewLog;
  activity: AppliedActivity | null;
  unlockedCardIds: string[];
  newBadges: string[];
}

function snapshot(card: Card): SchedSnapshot {
  return { repetition: card.repetition, easeFactor: card.easeFactor, intervalDays: card.intervalDays, due: card.due };
}

/**
 * Applies one answer in a single transaction: card schedule, review log,
 * daily stats and XP, and unlocking the listening card. Badges are checked
 * after the commit. `hooks.beforeCommit` exists for atomicity tests.
 */
export async function answerCard(
  input: AnswerCardInput,
  database: HanziStepDB = db,
  hooks: { beforeCommit?: () => void } = {},
): Promise<AnswerCardResult> {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  const result = await database.transaction(
    'rw',
    [database.words, database.chars, database.cards, database.reviewLogs, database.dailyStats, database.kv],
    async () => {
      const card = await database.cards.get(input.cardId);
      if (!card) throw new Error(`Không tìm thấy thẻ ${input.cardId}`);
      const settings = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
      const quality = qualityFor(input.signal);
      const practiceOnly = input.mode === 'retry';
      const scheduled = practiceOnly ? card : scheduleCard(card, quality, nowMs, schedulerFor(settings.scheduler));
      const next = practiceOnly
        ? scheduled
        : {
            ...scheduled,
            schedulerStates: { ...scheduled.schedulerStates, [settings.scheduler]: storedSchedule(scheduled) },
          };
      if (!practiceOnly) await database.cards.put(next);

      // Listening opens after one reading repetition, speaking after two (docs/PLAN.md §5.1).
      const UNLOCKS: readonly { facet: Facet; minRepetition: number }[] = [
        { facet: 'listen', minRepetition: 1 },
        { facet: 'speak', minRepetition: 2 },
      ];
      const unlockedCardIds: string[] = [];
      if (!practiceOnly && next.facet === 'read') {
        for (const rule of UNLOCKS) {
          if (next.repetition < rule.minRepetition || !settings.enabledFacets.includes(rule.facet)) continue;
          const sibling = await database.cards.get(cardId(rule.facet, next.subjectId));
          if (sibling?.state === 'suspended') {
            await database.cards.put({ ...sibling, state: 'new', due: nowMs });
            unlockedCardIds.push(sibling.id);
          }
        }
        if (next.repetition >= 3 && settings.enabledFacets.includes('write')) {
          const word = await database.words.get(next.subjectId);
          if (word) {
            for (const character of hanCharacters(word.simplified)) {
              const incoming = characterFromWord(character, word, nowMs);
              await database.chars.put(mergeCharacter(await database.chars.get(character), incoming));
              const id = cardId('write', character);
              if (!(await database.cards.get(id))) {
                await database.cards.put(createCard(character, 'write', nowMs, false, 'char'));
                unlockedCardIds.push(id);
              }
            }
          }
        }
      }

      const log: ReviewLog = {
        cardId: card.id,
        subjectId: card.subjectId,
        facet: card.facet,
        questionType: input.signal.questionType,
        mode: input.mode,
        correct: input.signal.correct,
        quality,
        rating: toRating(quality),
        elapsedMs: Math.max(0, Math.round(input.signal.elapsedMs)),
        hints: input.signal.hints ?? 0,
        replays: input.signal.replays ?? 0,
        reviewedAt: nowMs,
        dayKey: toDayKey(now, settings.dayStartHour),
        before: snapshot(card),
        after: snapshot(next),
      };
      log.id = await database.reviewLogs.add(log);

      const correct = input.signal.correct;
      let activity: AppliedActivity | null = null;
      if (input.mode === 'review') {
        activity = await applyActivity(database, {
          kind: correct ? 'review-correct' : 'review-wrong',
          counters: { answers: 1, correct: correct ? 1 : 0 },
          now,
        });
      } else if (input.mode === 'learn') {
        activity = await applyActivity(database, { kind: 'learn-word', counters: { newIntroduced: 1 }, now });
      } else if (input.mode === 'retry' && correct) {
        activity = await applyActivity(database, { kind: 'retry-correct', now });
      }

      hooks.beforeCommit?.();
      return { quality, card: next, log, activity, unlockedCardIds };
    },
  );

  const newBadges = await evaluateBadges(database, now);
  return { ...result, newBadges };
}

/** +30 XP when the session was long enough; null otherwise. */
export async function completeSession(
  answers: number,
  queueEmptied: boolean,
  database: HanziStepDB = db,
): Promise<ActivityResult | null> {
  if (!sessionCompleteEligible(answers, queueEmptied)) return null;
  return recordActivity({ kind: 'session-complete' }, database);
}
