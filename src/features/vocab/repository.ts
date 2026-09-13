import { db, type HanziStepDB } from '@/db/db';
import { normalizeSettings, SETTINGS_KEY } from '@/db/settings';
import type { Card, Word } from '@/domain/types';
import { applyActivity, evaluateBadges, recordActivity, type ActivityResult } from '@/progress/recordActivity';
import { cardId, createCard } from '@/srs/cards';
import { imageCacheKey } from '@/services/images/store';

export function findWordByKey(simplified: string, pinyinNum: string, database: HanziStepDB = db): Promise<Word | undefined> {
  return database.words.where('[simplified+pinyinNum]').equals([simplified, pinyinNum]).first();
}

/**
 * Starts learning a word: stores it (or reuses the saved copy) and creates its
 * cards — `read` active, `listen` suspended until the read card reaches rep 1.
 */
export async function introduceWord(
  word: Word,
  options: { now?: number } = {},
  database: HanziStepDB = db,
): Promise<{ word: Word; created: boolean }> {
  const now = options.now ?? Date.now();
  return database.transaction('rw', [database.words, database.cards, database.kv], async () => {
    const settings = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
    const existing = await findWordByKey(word.simplified, word.pinyinNum, database);
    const stored: Word = existing ? { ...existing, knownWithoutSrs: false, updatedAt: now } : { ...word, updatedAt: now };
    await database.words.put(stored);

    const cards: Card[] = [];
    if (!(await database.cards.get(cardId('read', stored.id)))) cards.push(createCard(stored.id, 'read', now));
    // Listening and speaking cards start suspended; answering the reading card opens them.
    for (const facet of ['listen', 'speak'] as const) {
      if (settings.enabledFacets.includes(facet) && !(await database.cards.get(cardId(facet, stored.id)))) {
        cards.push(createCard(stored.id, facet, now, true));
      }
    }
    if (cards.length > 0) await database.cards.bulkPut(cards);
    return { word: stored, created: !existing };
  });
}

/** Saves a word to learn later (from lookup or reading) without cards. XP is given only for new words. */
export async function saveWordForLater(
  word: Word,
  database: HanziStepDB = db,
): Promise<{ word: Word; created: boolean; activity: ActivityResult | null }> {
  const saved = await database.transaction('rw', database.words, async () => {
    const existing = await findWordByKey(word.simplified, word.pinyinNum, database);
    if (existing) return { word: existing, created: false };
    await database.words.add(word);
    return { word, created: true };
  });
  const activity = saved.created ? await recordActivity({ kind: 'save-word' }, database) : null;
  return { ...saved, activity };
}

/** "Tôi đã biết": keeps the word (so it is not offered again) and removes its cards. */
export async function markWordKnown(word: Word, database: HanziStepDB = db): Promise<Word> {
  const now = Date.now();
  return database.transaction('rw', [database.words, database.cards], async () => {
    const existing = await findWordByKey(word.simplified, word.pinyinNum, database);
    const stored: Word = { ...(existing ?? word), knownWithoutSrs: true, updatedAt: now };
    await database.words.put(stored);
    await database.cards.where('subjectId').equals(stored.id).delete();
    return stored;
  });
}

/** Deletes words and their cards. Review logs stay for statistics. */
export async function deleteWords(ids: readonly string[], database: HanziStepDB = db): Promise<void> {
  await database.transaction('rw', [database.words, database.chars, database.cards, database.caches], async () => {
    await database.cards.where('subjectId').anyOf([...ids]).delete();
    const affectedChars = await database.chars.where('wordIds').anyOf([...ids]).toArray();
    for (const char of affectedChars) {
      const wordIds = char.wordIds.filter((wordId) => !ids.includes(wordId));
      if (wordIds.length > 0) await database.chars.put({ ...char, wordIds, updatedAt: Date.now() });
      else {
        await database.chars.delete(char.id);
        await database.cards.delete(`write:${char.id}`);
      }
    }
    await database.words.bulkDelete([...ids]);
    await database.caches.bulkDelete(ids.map(imageCacheKey));
  });
}

export function normalizeTags(tags: readonly string[]): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    const clean = tag.replace(/^#+/, '').replace(/,/g, '').trim().slice(0, 24);
    if (clean && !result.includes(clean)) result.push(clean);
  }
  return result.slice(0, 10);
}

/** Replaces a word's tags; the first time a word gets tags gives +10 XP (as in the English app). */
export async function setWordTags(id: string, tags: readonly string[], database: HanziStepDB = db): Promise<ActivityResult | null> {
  const now = new Date();
  const activity = await database.transaction('rw', [database.words, database.dailyStats, database.kv], async () => {
    const word = await database.words.get(id);
    if (!word) throw new Error('Không tìm thấy từ.');
    const next = normalizeTags(tags);
    const firstTag = word.tagRewardedAt === undefined && word.tags.length === 0 && next.length > 0;
    await database.words.put({
      ...word,
      tags: next,
      tagRewardedAt: firstTag ? now.getTime() : word.tagRewardedAt,
      updatedAt: now.getTime(),
    });
    return firstTag ? applyActivity(database, { kind: 'first-tag', now }) : null;
  });
  if (!activity) return null;
  return { ...activity, newBadges: await evaluateBadges(database, now) };
}

export async function updateWord(
  id: string,
  patch: Partial<Omit<Word, 'id' | 'simplified' | 'pinyinNum' | 'createdAt'>>,
  database: HanziStepDB = db,
): Promise<void> {
  await database.words.update(id, { ...patch, updatedAt: Date.now() });
}

/** Saved words that have no cards yet and are not marked known, oldest first (they are learned before HSK words). */
export async function pendingWordsToLearn(database: HanziStepDB = db): Promise<Word[]> {
  const [words, cards] = await Promise.all([database.words.orderBy('createdAt').toArray(), database.cards.toArray()]);
  const withCards = new Set(cards.map((card) => card.subjectId));
  return words.filter((word) => !word.knownWithoutSrs && !withCards.has(word.id));
}
