import { db, type HanziStepDB } from '@/db/db';
import type { ReplayLog } from './replay';

/** How many cards a comparison replays; enough to be representative, cheap to run. */
export const MAX_REPLAY_CARDS = 500;

/**
 * One history per card, oldest answer first, for replaying a review log through
 * a different scheduler (docs/PLAN.md §10, Phase 5).
 */
export async function loadReviewHistories(database: HanziStepDB = db, maxCards = MAX_REPLAY_CARDS): Promise<ReplayLog[][]> {
  const logs = await database.reviewLogs.toArray();
  const byCard = new Map<string, ReplayLog[]>();
  for (const log of logs) {
    const history = byCard.get(log.cardId);
    const entry: ReplayLog = { quality: log.quality, reviewedAt: log.reviewedAt, mode: log.mode };
    if (history) history.push(entry);
    else byCard.set(log.cardId, [entry]);
  }
  return [...byCard.values()].slice(0, maxCards);
}
