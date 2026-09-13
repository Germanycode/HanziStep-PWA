import Dexie, { type EntityTable } from 'dexie';
import type {
  AudioCacheEntry,
  CacheEntry,
  Card,
  CoachSession,
  DailyStats,
  DictEntry,
  HanziCharacter,
  KvEntry,
  ReviewLog,
  TextDoc,
  Word,
} from '@/domain/types';
import { charactersFromWords } from '@/features/writing/characters';
import { createCard } from '@/srs/cards';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4 } from './schema';

export const DB_NAME = 'hanzistep';

export class HanziStepDB extends Dexie {
  declare words: EntityTable<Word, 'id'>;
  declare chars: EntityTable<HanziCharacter, 'id'>;
  declare cards: EntityTable<Card, 'id'>;
  declare reviewLogs: EntityTable<ReviewLog, 'id'>;
  declare dailyStats: EntityTable<DailyStats, 'dayKey'>;
  declare texts: EntityTable<TextDoc, 'id'>;
  declare dict: EntityTable<DictEntry, 'id'>;
  declare caches: EntityTable<CacheEntry, 'key'>;
  declare audioCache: EntityTable<AudioCacheEntry, 'key'>;
  declare coachSessions: EntityTable<CoachSession, 'id'>;
  declare kv: EntityTable<KvEntry, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2)
      .stores(SCHEMA_V2)
      .upgrade(async (transaction) => {
        await transaction
          .table('words')
          .toCollection()
          .modify((word) => {
            if (Array.isArray(word.tags) && word.tags.length > 0 && word.tagRewardedAt === undefined) {
              word.tagRewardedAt = typeof word.updatedAt === 'number' ? word.updatedAt : Date.now();
            }
          });
      });
    this.version(3)
      .stores(SCHEMA_V3)
      .upgrade(async (transaction) => {
        const words = (await transaction.table('words').toArray()) as Word[];
        const readCards = (await transaction.table('cards').where('facet').equals('read').toArray()) as Card[];
        const repetition = new Map(readCards.map((card) => [card.subjectId, card.repetition]));
        const now = Date.now();
        const chars = charactersFromWords(words, now);
        if (chars.length > 0) await transaction.table('chars').bulkPut(chars);
        const cards = chars
          .filter((char) => char.wordIds.some((wordId) => (repetition.get(wordId) ?? 0) >= 3))
          .map((char) => createCard(char.id, 'write', now, true, 'char'));
        if (cards.length > 0) await transaction.table('cards').bulkPut(cards);
      });
    this.version(4)
      .stores(SCHEMA_V4)
      .upgrade(async (transaction) => {
        const words = (await transaction.table('words').toArray()) as Word[];
        const existing = (await transaction.table('chars').toArray()) as HanziCharacter[];
        const existingById = new Map(existing.map((char) => [char.id, char]));
        const rebuilt = charactersFromWords(words).map((char) => ({
          ...char,
          createdAt: existingById.get(char.id)?.createdAt ?? char.createdAt,
        }));
        const rebuiltIds = new Set(rebuilt.map((char) => char.id));
        const orphans = existing.filter((char) => !rebuiltIds.has(char.id));
        await transaction.table('chars').clear();
        if (rebuilt.length + orphans.length > 0) await transaction.table('chars').bulkPut([...rebuilt, ...orphans]);
      });
  }
}

export const db = new HanziStepDB();
