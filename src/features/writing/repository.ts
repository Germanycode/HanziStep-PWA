import { db, type HanziStepDB } from '@/db/db';
import { cardId, createCard } from '@/srs/cards';
import { characterFromWord, hanCharacters, mergeCharacter } from './characters';

/** Backfills character subjects for words that were already mastered before writing was enabled. */
export async function syncWritingCharacters(database: HanziStepDB = db, now = Date.now()): Promise<number> {
  return database.transaction('rw', [database.words, database.chars, database.cards], async () => {
    const readCards = await database.cards.where('facet').equals('read').toArray();
    const eligible = readCards.filter((card) => card.repetition >= 3).map((card) => card.subjectId);
    const words = await database.words.bulkGet(eligible);
    let created = 0;
    for (const word of words) {
      if (!word) continue;
      for (const character of hanCharacters(word.simplified)) {
        const incoming = characterFromWord(character, word, now);
        await database.chars.put(mergeCharacter(await database.chars.get(character), incoming));
        const id = cardId('write', character);
        const existing = await database.cards.get(id);
        if (!existing) {
          await database.cards.put(createCard(character, 'write', now, false, 'char'));
          created++;
        } else if (existing.state === 'suspended') {
          await database.cards.put({ ...existing, state: 'new', due: now });
        }
      }
    }
    return created;
  });
}
