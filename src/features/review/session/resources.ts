import { levelOf, loadHskUpTo } from '@/data/hsk';
import { findExampleSentences } from '@/data/sentences';
import type { SentenceRecord } from '@/data/types';
import { db, type HanziStepDB } from '@/db/db';
import { getSettings } from '@/db/settings';
import type { Card, Settings, Word } from '@/domain/types';
import { toDayKey } from '@/lib/dayKey';
import { shuffle, type Rng } from '@/lib/random';
import { listChineseVoices } from '@/services/speech/tts';
import { IMAGE_KIND } from '@/services/images/store';
import { buildCandidatePool } from '../engine/candidates';
import type { DistractorCandidate } from '../engine/distractors';
import { buildQuestion, type Question, type QuestionResources } from '../engine/questions';
import { buildReviewPlan, type ReviewPlan, type SessionItem } from '../engine/session';

export interface SessionContext {
  settings: Settings;
  words: Map<string, Word>;
  cards: Map<string, Card>;
  pool: DistractorCandidate[];
  /** Words already introduced, usable in matching questions. */
  learned: Word[];
  /** A Chinese voice can read whole sentences. */
  sentenceAudio: boolean;
  geminiAvailable: boolean;
  /** Owners that really have a stored image blob, not just a stale metadata flag. */
  imageOwners: ReadonlySet<string>;
}

/** Everything a review session needs, loaded once when it starts. */
export async function loadSessionContext(
  tag?: string,
  now = Date.now(),
  database: HanziStepDB = db,
): Promise<{ context: SessionContext; plan: ReviewPlan }> {
  const settings = await getSettings(database);
  const [words, cards, stats, voices, imageKeys] = await Promise.all([
    database.words.toArray(),
    database.cards.toArray(),
    database.dailyStats.get(toDayKey(new Date(now), settings.dayStartHour)),
    listChineseVoices().catch(() => []),
    database.caches.where('kind').equals(IMAGE_KIND).primaryKeys(),
  ]);
  const wordMap = new Map(words.map((word) => [word.id, word]));
  const wordCards = cards.filter((card) => card.subjectType === 'word');
  const plan = buildReviewPlan({
    cards: wordCards,
    words: wordMap,
    now,
    reviewedToday: stats?.answers ?? 0,
    maxReviewsPerDay: settings.maxReviewsPerDay,
    tag,
  });
  const hsk = await loadHskUpTo(settings.hskTrack, Math.max(2, settings.currentLevel)).catch(() => []);
  const introduced = new Set(cards.filter((card) => card.facet === 'read').map((card) => card.subjectId));

  return {
    plan,
    context: {
      settings,
      words: wordMap,
      cards: new Map(wordCards.map((card) => [card.id, card])),
      pool: buildCandidatePool(words, hsk, settings.hskTrack),
      learned: words.filter((word) => introduced.has(word.id) && !word.knownWithoutSrs && word.meaningVi.length > 0),
      sentenceAudio: voices.length > 0,
      geminiAvailable: settings.geminiApiKey.trim().length > 0,
      imageOwners: new Set(imageKeys.map((key) => key.slice(IMAGE_KIND.length + 1))),
    },
  };
}

function storedExamples(word: Word): SentenceRecord[] {
  return word.examples.map((example) => ({ zh: example.zh, en: example.vi ?? example.en ?? '', ids: [] }));
}

/** Example sentences, matching partners and image state for one word. */
export async function questionResources(
  word: Word,
  context: SessionContext,
  ahead: readonly SessionItem[],
  rng: Rng,
): Promise<QuestionResources> {
  const hskLevel = levelOf(word.hsk, context.settings.hskTrack);
  const examples =
    word.examples.length > 0 ? storedExamples(word) : await findExampleSentences(word.simplified, hskLevel ?? 3, 3).catch(() => []);
  // Words still due later in this session come first: matching them counts as their review.
  const aheadIds = new Set(ahead.filter((item) => item.facet === 'read').map((item) => item.subjectId));
  const others = context.learned.filter((item) => item.id !== word.id);
  return {
    pool: context.pool,
    matchWords: [...others.filter((item) => aheadIds.has(item.id)), ...shuffle(others.filter((item) => !aheadIds.has(item.id)), rng)],
    examples,
    hasImage: word.imageStatus === 'ok' && context.imageOwners.has(word.id),
    geminiAvailable: context.geminiAvailable,
    sentenceAudio: context.sentenceAudio,
    hskLevel,
  };
}

export async function prepareQuestion(
  item: SessionItem,
  context: SessionContext,
  ahead: readonly SessionItem[],
  options: { retry?: boolean; forceType?: Question['type'] },
  rng: Rng,
): Promise<Question> {
  const word = context.words.get(item.subjectId);
  const card = context.cards.get(item.cardId);
  if (!word || !card) throw new Error('Thẻ này không còn trong danh sách từ.');
  const resources = await questionResources(word, context, ahead, rng);
  return buildQuestion(
    { word, facet: item.facet, repetition: card.repetition, retry: options.retry, forceType: options.forceType },
    resources,
    rng,
  );
}
