import { db, type HanziStepDB } from '@/db/db';
import { planBacklogSpread, type SpreadPlan } from '@/srs/backlog';

export type { SpreadPlan } from '@/srs/backlog';

export interface BacklogOptions {
  perDay: number;
  todayCapacity: number;
  tag?: string;
  now?: number;
}

async function scopedCards(options: BacklogOptions, database: HanziStepDB) {
  const cards = (await database.cards.toArray()).filter((card) => card.subjectType === 'word');
  if (!options.tag) return cards;
  const wordIds = new Set(
    (await database.words.filter((word) => word.tags.includes(options.tag!)).toArray()).map((word) => word.id),
  );
  return cards.filter((card) => card.subjectType !== 'word' || wordIds.has(card.subjectId));
}

/** What spreading would do, without changing anything. */
export async function previewBacklogSpread(options: BacklogOptions, database: HanziStepDB = db): Promise<SpreadPlan> {
  return planBacklogSpread(await scopedCards(options, database), {
    now: options.now ?? Date.now(),
    perDay: options.perDay,
    todayCapacity: options.todayCapacity,
  });
}

/** Moves only the selected tag's overdue pile and returns what it did. */
export async function spreadBacklog(options: BacklogOptions, database: HanziStepDB = db): Promise<SpreadPlan> {
  return database.transaction('rw', [database.cards, database.words], async () => {
    const plan = planBacklogSpread(await scopedCards(options, database), {
      now: options.now ?? Date.now(),
      perDay: options.perDay,
      todayCapacity: options.todayCapacity,
    });
    for (const update of plan.updates) await database.cards.update(update.id, { due: update.due });
    return plan;
  });
}
