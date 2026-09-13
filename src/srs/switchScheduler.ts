import { db, type HanziStepDB } from '@/db/db';
import { normalizeSettings, SETTINGS_KEY } from '@/db/settings';
import type { Card, CardState, Settings } from '@/domain/types';
import { replayCard, type ReplayLog } from './replay';
import type { SchedState } from './scheduler';
import { schedulerFor } from './schedulers';

export type StoredSchedule = NonNullable<NonNullable<Card['schedulerStates']>['sm2']>;

export function storedSchedule(state: SchedState): StoredSchedule {
  return {
    repetition: state.repetition,
    easeFactor: state.easeFactor,
    intervalDays: state.intervalDays,
    due: state.due,
    lapses: state.lapses,
    lastReviewedAt: state.lastReviewedAt,
    fsrs: state.fsrs,
  };
}

function stateFor(card: Card, state: StoredSchedule): CardState {
  if (card.state === 'suspended') return 'suspended';
  if (state.intervalDays >= 1) return 'review';
  return state.lapses > card.lapses ? 'relearning' : 'learning';
}

export interface SchedulerSwitchResult {
  from: Settings['scheduler'];
  to: Settings['scheduler'];
  cards: number;
  replayed: number;
}

/**
 * Saves the active schedule, then restores or replays the target algorithm for
 * every current card in the same transaction as the setting change.
 */
export async function switchScheduler(
  to: Settings['scheduler'],
  database: HanziStepDB = db,
): Promise<SchedulerSwitchResult> {
  return database.transaction('rw', [database.cards, database.reviewLogs, database.kv], async () => {
    const settings = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
    const from = settings.scheduler;
    const cards = await database.cards.toArray();
    if (from === to) return { from, to, cards: cards.length, replayed: 0 };

    const histories = new Map<string, ReplayLog[]>();
    for (const log of await database.reviewLogs.toArray()) {
      const history = histories.get(log.cardId) ?? [];
      history.push({ quality: log.quality, reviewedAt: log.reviewedAt, mode: log.mode });
      histories.set(log.cardId, history);
    }

    let replayed = 0;
    const scheduler = schedulerFor(to);
    const updated = cards.map((card) => {
      const current = storedSchedule(card);
      const states = { ...card.schedulerStates, [from]: current };
      let target = states[to];
      if (!target) {
        const replayedState = replayCard(histories.get(card.id) ?? [], scheduler);
        if (replayedState) {
          target = storedSchedule(replayedState);
          replayed++;
        } else {
          // Imported/new cards may have no history. Preserve their current due
          // date and let FSRS seed memory from that interval on first use.
          target = { ...current, fsrs: to === 'fsrs' ? current.fsrs : undefined };
        }
      }
      return {
        ...card,
        ...target,
        state: stateFor(card, target),
        schedulerStates: { ...states, [to]: target },
      };
    });

    if (updated.length > 0) await database.cards.bulkPut(updated);
    await database.kv.put({ key: SETTINGS_KEY, value: { ...settings, scheduler: to } });
    return { from, to, cards: updated.length, replayed };
  });
}
