import { db, type HanziStepDB } from '@/db/db';
import type { CoachSession } from '@/domain/types';
import { recordActivity, type ActivityResult } from '@/progress/recordActivity';

export type TranscriptLine = CoachSession['transcript'][number];

/** A conversation is worth XP once it actually got going (docs/PLAN.md §6.1). */
const MIN_LINES_FOR_XP = 4;

export async function saveCoachSession(
  input: { scenario: string; startedAt: number; transcript: readonly TranscriptLine[] },
  database: HanziStepDB = db,
): Promise<{ session: CoachSession; activity: ActivityResult | null }> {
  const endedAt = Date.now();
  const session: CoachSession = {
    id: crypto.randomUUID(),
    scenario: input.scenario,
    startedAt: input.startedAt,
    endedAt,
    transcript: [...input.transcript],
  };
  await database.coachSessions.add(session);

  const seconds = Math.max(0, Math.round((endedAt - input.startedAt) / 1000));
  const activity =
    input.transcript.length >= MIN_LINES_FOR_XP
      ? await recordActivity({ kind: 'coach', counters: { coachSeconds: seconds } }, database)
      : null;
  return { session, activity };
}

export function listCoachSessions(database: HanziStepDB = db): Promise<CoachSession[]> {
  return database.coachSessions.orderBy('startedAt').reverse().limit(20).toArray();
}

export async function deleteCoachSession(id: string, database: HanziStepDB = db): Promise<void> {
  await database.coachSessions.delete(id);
}
