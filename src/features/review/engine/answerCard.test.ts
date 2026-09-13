import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from '@/db/db';
import { updateSettings } from '@/db/settings';
import type { Word } from '@/domain/types';
import { introduceWord, markWordKnown, pendingWordsToLearn, saveWordForLater, setWordTags, deleteWords } from '@/features/vocab/repository';
import { emptyDailyStats } from '@/progress/state';
import { IMAGE_KIND, imageCacheKey } from '@/services/images/store';
import { LEARNING_STEP_DAYS } from '@/srs/scheduler';
import { answerCard, completeSession } from './answerCard';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`answer-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

function makeWord(simplified: string, pinyinNum: string, overrides: Partial<Word> = {}): Word {
  return {
    id: crypto.randomUUID(),
    simplified,
    pinyinNum,
    pinyinVariants: [],
    hanViet: '',
    meaningVi: ['nghĩa'],
    meaningEn: [],
    pos: ['n'],
    classifiers: [],
    hsk: { hsk3: 1 },
    cognate: false,
    source: 'hsk-list',
    examples: [],
    imageStatus: 'none',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

const at = (hour: number, minute = 0) => new Date(2026, 8, 11, hour, minute);

describe('introduceWord and the vocabulary repository', () => {
  it('creates an active read card and a suspended listen card, once', async () => {
    const database = freshDb();
    const word = makeWord('银行', 'yin2 hang2');
    const first = await introduceWord(word, { now: 1000 }, database);
    const second = await introduceWord(makeWord('银行', 'yin2 hang2'), { now: 2000 }, database);
    expect(first.created).toBe(true);
    expect(second).toMatchObject({ created: false, word: { id: word.id } });
    const cards = await database.cards.toArray();
    expect(cards.map((card) => [card.id, card.state]).sort()).toEqual([
      [`listen:${word.id}`, 'suspended'],
      [`read:${word.id}`, 'new'],
    ]);
  });

  it('skips the listen card when the listening facet is disabled', async () => {
    const database = freshDb();
    await updateSettings({ enabledFacets: ['read'] }, database);
    const { word } = await introduceWord(makeWord('书', 'shu1'), {}, database);
    expect((await database.cards.toArray()).map((card) => card.id)).toEqual([`read:${word.id}`]);
  });

  it('saves words for later with XP once, lists them as pending, and marks known words', async () => {
    const database = freshDb();
    const saved = await saveWordForLater(makeWord('猫', 'mao1'), database);
    expect(saved.activity?.xpAwarded).toBe(10);
    expect((await saveWordForLater(makeWord('猫', 'mao1'), database)).activity).toBeNull();
    expect((await pendingWordsToLearn(database)).map((word) => word.simplified)).toEqual(['猫']);

    await introduceWord(saved.word, {}, database);
    expect(await pendingWordsToLearn(database)).toEqual([]);
    const known = await markWordKnown(saved.word, database);
    expect(known.knownWithoutSrs).toBe(true);
    expect(await database.cards.count()).toBe(0);
    expect(await pendingWordsToLearn(database)).toEqual([]);
  });

  it('tags words with a one-time XP bonus and deletes words with their cards', async () => {
    const database = freshDb();
    const { word } = await introduceWord(makeWord('水', 'shui3'), {}, database);
    expect((await setWordTags(word.id, ['#HSK1', 'HSK1', ' đồ uống '], database))?.xpAwarded).toBe(10);
    expect((await database.words.get(word.id))?.tags).toEqual(['HSK1', 'đồ uống']);
    expect(await setWordTags(word.id, ['khác'], database)).toBeNull();
    expect(await setWordTags(word.id, [], database)).toBeNull();
    expect(await setWordTags(word.id, ['HSK1'], database)).toBeNull();
    await database.caches.put({ key: imageCacheKey(word.id), kind: IMAGE_KIND, value: {}, createdAt: 1, expiresAt: 2 });
    await deleteWords([word.id], database);
    expect(await database.words.count()).toBe(0);
    expect(await database.cards.count()).toBe(0);
    expect(await database.caches.get(imageCacheKey(word.id))).toBeUndefined();
  });
});

describe('answerCard', () => {
  it('schedules a review answer, logs it and awards XP', async () => {
    const database = freshDb();
    const { word } = await introduceWord(makeWord('你', 'ni3'), { now: at(8).getTime() }, database);
    const result = await answerCard(
      { cardId: `read:${word.id}`, mode: 'review', signal: { questionType: 'mcq-hanzi-vi', correct: true, elapsedMs: 2000 }, now: at(9) },
      database,
    );
    expect(result.quality).toBe(5);
    expect(result.card).toMatchObject({ repetition: 1, state: 'learning', lastReviewedAt: at(9).getTime() });
    expect(result.card.intervalDays).toBeCloseTo(LEARNING_STEP_DAYS);
    expect(result.log).toMatchObject({ mode: 'review', rating: 4, dayKey: '2026-09-11', before: { repetition: 0 }, after: { repetition: 1 } });
    expect(result.activity).toMatchObject({ xpAwarded: 15 });
    expect(await database.dailyStats.get('2026-09-11')).toMatchObject({ answers: 1, correct: 1, learningXp: 15 });
    expect(await database.reviewLogs.count()).toBe(1);
  });

  it('unlocks the listen card once the read card reaches repetition 1', async () => {
    const database = freshDb();
    const { word } = await introduceWord(makeWord('好', 'hao3'), { now: 0 }, database);
    const wrong = await answerCard(
      { cardId: `read:${word.id}`, mode: 'review', signal: { questionType: 'mcq-hanzi-vi', correct: false, elapsedMs: 2000 }, now: at(9) },
      database,
    );
    expect(wrong.unlockedCardIds).toEqual([]);
    const right = await answerCard(
      { cardId: `read:${word.id}`, mode: 'review', signal: { questionType: 'mcq-hanzi-vi', correct: true, elapsedMs: 2000 }, now: at(10) },
      database,
    );
    expect(right.unlockedCardIds).toEqual([`listen:${word.id}`]);
    expect(await database.cards.get(`listen:${word.id}`)).toMatchObject({ state: 'new', due: at(10).getTime() });
  });

  it('unlocks one write card per character when reading reaches repetition 3', async () => {
    const database = freshDb();
    await updateSettings({ enabledFacets: ['read', 'write'] }, database);
    const { word } = await introduceWord(makeWord('你好', 'ni3 hao3', { hanViet: 'NỄ HẢO' }), { now: 0 }, database);
    await database.cards.update(`read:${word.id}`, { repetition: 2, intervalDays: 1, state: 'review' });
    const result = await answerCard(
      { cardId: `read:${word.id}`, mode: 'review', signal: { questionType: 'mcq-hanzi-vi', correct: true, elapsedMs: 2000 }, now: at(10) },
      database,
    );
    expect(result.unlockedCardIds).toEqual(['write:你', 'write:好']);
    expect(await database.cards.get('write:你')).toMatchObject({ subjectType: 'char', subjectId: '你', state: 'new' });
    expect(await database.chars.get('好')).toMatchObject({ wordIds: [word.id], pinyin: ['hao3'], hanViet: ['HẢO'] });
  });

  it('counts learn answers as new words on the right day (dayStartHour)', async () => {
    const database = freshDb();
    await updateSettings({ dayStartHour: 3 }, database);
    const { word } = await introduceWord(makeWord('学', 'xue2'), { now: 0 }, database);
    const result = await answerCard(
      { cardId: `read:${word.id}`, mode: 'learn', signal: { questionType: 'learn-intro', correct: false, elapsedMs: 9000 }, now: new Date(2026, 8, 12, 2, 30) },
      database,
    );
    expect(result.activity).toMatchObject({ xpAwarded: 5, dayKey: '2026-09-11' });
    expect(result.card.repetition).toBe(0);
    expect((await database.dailyStats.get('2026-09-11'))?.newIntroduced).toBe(1);
  });

  it('never changes the schedule in the retry round', async () => {
    const database = freshDb();
    const { word } = await introduceWord(makeWord('大', 'da4'), { now: 0 }, database);
    const before = await database.cards.get(`read:${word.id}`);
    const retry = await answerCard(
      { cardId: `read:${word.id}`, mode: 'retry', signal: { questionType: 'mcq-hanzi-vi', correct: true, elapsedMs: 1000 }, now: at(9) },
      database,
    );
    expect(await database.cards.get(`read:${word.id}`)).toEqual(before);
    expect(retry.log.before).toEqual(retry.log.after);
    expect(retry.activity).toMatchObject({ xpAwarded: 3 });
    expect((await database.dailyStats.get('2026-09-11'))?.answers).toBe(0);
    const wrongRetry = await answerCard(
      { cardId: `read:${word.id}`, mode: 'retry', signal: { questionType: 'mcq-hanzi-vi', correct: false, elapsedMs: 1000 }, now: at(9) },
      database,
    );
    expect(wrongRetry.activity).toBeNull();
  });

  it('schedules match bonuses without XP', async () => {
    const database = freshDb();
    const { word } = await introduceWord(makeWord('小', 'xiao3'), { now: 0 }, database);
    const bonus = await answerCard(
      { cardId: `read:${word.id}`, mode: 'match-bonus', signal: { questionType: 'match', correct: true, elapsedMs: 5000 }, now: at(9) },
      database,
    );
    expect(bonus).toMatchObject({ quality: 4, activity: null, card: { repetition: 1 } });
  });

  it('is atomic: a failure before commit writes nothing', async () => {
    const database = freshDb();
    const { word } = await introduceWord(makeWord('天', 'tian1'), { now: 0 }, database);
    const before = await database.cards.get(`read:${word.id}`);
    await expect(
      answerCard(
        { cardId: `read:${word.id}`, mode: 'review', signal: { questionType: 'mcq-hanzi-vi', correct: true, elapsedMs: 1000 }, now: at(9) },
        database,
        {
          beforeCommit: () => {
            throw new Error('boom');
          },
        },
      ),
    ).rejects.toThrow('boom');
    expect(await database.cards.get(`read:${word.id}`)).toEqual(before);
    expect(await database.reviewLogs.count()).toBe(0);
    expect(await database.dailyStats.get('2026-09-11')).toBeUndefined();
  });

  it('rejects unknown cards and awards the session bonus only for real sessions', async () => {
    const database = freshDb();
    await expect(
      answerCard({ cardId: 'read:missing', mode: 'review', signal: { questionType: 'match', correct: true, elapsedMs: 0 } }, database),
    ).rejects.toThrow();
    expect(await completeSession(3, true, database)).toBeNull();
    expect((await completeSession(12, false, database))?.xpAwarded).toBe(30);
    expect(emptyDailyStats('2026-09-11').answers).toBe(0);
  });
});
