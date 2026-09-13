import { toNumbered } from '@/chinese/pinyin/marks';
import { SYLLABLE_SET } from '@/chinese/pinyin/syllables';
import type { PinyinTone, Syllable } from '@/chinese/pinyin/types';
import { shuffle, type Rng } from '@/lib/random';

/** The fields distractor selection needs, from saved words or HSK list records. */
export interface DistractorCandidate {
  id: string;
  simplified: string;
  pinyinNum: string;
  meaningVi: string[];
  pos: string[];
  hskLevel?: number;
}

const STOP_WORDS = new Set([
  'của', 'và', 'là', 'một', 'các', 'những', 'cái', 'sự', 'việc', 'được', 'cho', 'để', 'với', 'trong', 'khi', 'có',
  'không', 'đã', 'sẽ', 'rất', 'hay', 'hoặc', 'từ', 'lượng', 'biến', 'thể',
]);

function normalize(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('vi').trim();
}

/** First meaning without notes in brackets, e.g. "(động từ) ăn; dùng bữa" → "ăn". */
export function mainGloss(meanings: readonly string[]): string {
  const first = meanings[0] ?? '';
  return normalize(first.replace(/\([^)]*\)|\[[^\]]*\]/g, '').split(/[;,，；]/)[0] ?? '');
}

/** Every listed gloss of the first meanings, normalised ("vui mừng; vui vẻ" → {"vui mừng", "vui vẻ"}). */
function glossSet(meanings: readonly string[]): Set<string> {
  return new Set(
    meanings
      .slice(0, 3)
      .flatMap((meaning) => meaning.replace(/\([^)]*\)|\[[^\]]*\]/g, '').split(/[;,，；]/))
      .map(normalize)
      .filter(Boolean),
  );
}

function glossTokens(meanings: readonly string[]): Set<string> {
  const text = meanings.slice(0, 2).map((meaning) => meaning.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')).join(' ');
  return new Set(
    normalize(text)
      .split(/[^\p{L}]+/u)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

/**
 * Two meanings count as overlapping when their main glosses are equal or one
 * contains the other, or their words overlap with Jaccard > 0.4
 * (高兴 "vui mừng" vs 快乐 "vui vẻ") — so a question never has two right answers.
 */
export function glossesOverlap(a: readonly string[], b: readonly string[]): boolean {
  const mainA = mainGloss(a);
  const mainB = mainGloss(b);
  if (!mainA || !mainB) return false;
  if (mainA === mainB || mainA.includes(mainB) || mainB.includes(mainA)) return true;
  const setB = glossSet(b);
  if ([...glossSet(a)].some((gloss) => setB.has(gloss))) return true;
  const tokensA = glossTokens(a);
  const tokensB = glossTokens(b);
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 && shared / union > 0.4;
}

function sharesPos(a: DistractorCandidate, b: DistractorCandidate): boolean {
  return a.pos.some((pos) => b.pos.includes(pos));
}

function rankAndPick(
  candidates: readonly DistractorCandidate[],
  score: (candidate: DistractorCandidate) => number,
  accept: (candidate: DistractorCandidate, picked: readonly DistractorCandidate[]) => boolean,
  count: number,
  rng: Rng,
): DistractorCandidate[] {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: score(candidate) + rng() }))
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
  const picked: DistractorCandidate[] = [];
  for (const candidate of ranked) {
    if (picked.length >= count) break;
    if (accept(candidate, picked)) picked.push(candidate);
  }
  return picked;
}

/** Vietnamese-meaning options: same part of speech and level preferred; never a synonym of the answer or of each other. */
export function meaningDistractors(
  target: DistractorCandidate,
  pool: readonly DistractorCandidate[],
  count: number,
  rng: Rng,
): DistractorCandidate[] {
  const eligible = pool.filter(
    (candidate) =>
      candidate.simplified !== target.simplified && candidate.meaningVi.length > 0 && !glossesOverlap(target.meaningVi, candidate.meaningVi),
  );
  return rankAndPick(
    eligible,
    (candidate) => (sharesPos(candidate, target) ? 2 : 0) + (candidate.hskLevel === target.hskLevel ? 1 : 0),
    (candidate, picked) => picked.every((other) => !glossesOverlap(other.meaningVi, candidate.meaningVi)),
    count,
    rng,
  );
}

/** Chinese-word options: same length, sharing characters preferred, never the same word or a synonym. */
export function hanziDistractors(
  target: DistractorCandidate,
  pool: readonly DistractorCandidate[],
  count: number,
  rng: Rng,
): DistractorCandidate[] {
  const targetChars = [...target.simplified];
  const eligible = pool.filter(
    (candidate) => candidate.simplified !== target.simplified && !glossesOverlap(target.meaningVi, candidate.meaningVi),
  );
  return rankAndPick(
    eligible,
    (candidate) => {
      const chars = [...candidate.simplified];
      const sameLength = chars.length === targetChars.length ? 4 : 0;
      const shared = chars.filter((char) => targetChars.includes(char)).length * 2;
      return sameLength + shared + (candidate.hskLevel === target.hskLevel ? 1 : 0);
    },
    (candidate, picked) => picked.every((other) => other.simplified !== candidate.simplified),
    count,
    rng,
  );
}

function tonelessPinyin(pinyinNum: string): string {
  return pinyinNum.toLowerCase().replace(/[1-5]/g, '').replace(/\s+/g, ' ').trim();
}

/** Audio options: real words that sound alike (same syllables with other tones first). Exact homophones are excluded. */
export function soundAlikeDistractors(
  target: DistractorCandidate,
  pool: readonly DistractorCandidate[],
  count: number,
  rng: Rng,
): DistractorCandidate[] {
  const targetToneless = tonelessPinyin(target.pinyinNum);
  const targetSyllables = targetToneless.split(' ');
  const eligible = pool.filter(
    (candidate) =>
      candidate.simplified !== target.simplified && candidate.pinyinNum.toLowerCase() !== target.pinyinNum.toLowerCase(),
  );
  return rankAndPick(
    eligible,
    (candidate) => {
      const toneless = tonelessPinyin(candidate.pinyinNum);
      const syllables = toneless.split(' ');
      return (
        (toneless === targetToneless ? 6 : 0) +
        (syllables[0] === targetSyllables[0] ? 3 : 0) +
        (syllables.length === targetSyllables.length ? 1 : 0)
      );
    },
    (candidate, picked) =>
      picked.every((other) => other.simplified !== candidate.simplified && other.pinyinNum.toLowerCase() !== candidate.pinyinNum.toLowerCase()),
    count,
    rng,
  );
}

const INITIAL_SWAPS: readonly [string, string][] = [
  ['zh', 'z'],
  ['ch', 'c'],
  ['sh', 's'],
  ['n', 'l'],
  ['b', 'p'],
  ['d', 't'],
  ['g', 'k'],
];
const FINAL_SWAPS: readonly [string, string][] = [
  ['iang', 'ian'],
  ['uang', 'uan'],
  ['ang', 'an'],
  ['eng', 'en'],
  ['ing', 'in'],
];
const TWO_LETTER_INITIALS = new Set(['zh', 'ch', 'sh']);

/** Plausible misspellings of one syllable: other tones, then confusable initials and finals. All are real syllables. */
export function syllableConfusions(syllable: Syllable): { tones: Syllable[]; sounds: Syllable[] } {
  const tones = ([1, 2, 3, 4] as PinyinTone[]).filter((tone) => tone !== syllable.tone).map((tone) => ({ base: syllable.base, tone }));
  const bases = new Set<string>();
  const { base } = syllable;
  for (const [a, b] of INITIAL_SWAPS) {
    if (base.startsWith(a) && (a.length === 2 || !TWO_LETTER_INITIALS.has(base.slice(0, 2)))) bases.add(b + base.slice(a.length));
    if (base.startsWith(b) && (b.length === 2 || !TWO_LETTER_INITIALS.has(base.slice(0, 2)))) bases.add(a + base.slice(b.length));
  }
  for (const [a, b] of FINAL_SWAPS) {
    if (base.endsWith(a)) bases.add(base.slice(0, -a.length) + b);
    else if (base.endsWith(b)) bases.add(base.slice(0, -b.length) + a);
  }
  if (/^[nl]ü/.test(base)) bases.add(base.replace('ü', 'u'));
  if (/^[nl]u/.test(base)) bases.add(base.replace('u', 'ü'));
  const tone = syllable.tone === 5 ? 1 : syllable.tone;
  const sounds = [...bases].filter((item) => item !== base && SYLLABLE_SET.has(item)).map((item) => ({ base: item, tone }));
  return { tones, sounds };
}

/**
 * Pinyin options for a word (numbered strings): mostly one syllable with a
 * different tone, plus confusable sounds. Accepted readings are never offered.
 */
export function pinyinDistractors(target: readonly Syllable[], accepted: readonly string[], count: number, rng: Rng): string[] {
  const excluded = new Set([toNumbered(target), ...accepted].map((reading) => reading.toLowerCase()));
  const toneOptions: string[] = [];
  const soundOptions: string[] = [];
  target.forEach((syllable, index) => {
    const { tones, sounds } = syllableConfusions(syllable);
    const replace = (replacement: Syllable) => toNumbered(target.map((item, i) => (i === index ? replacement : item)));
    toneOptions.push(...tones.map(replace));
    soundOptions.push(...sounds.map(replace));
  });
  const ordered = [...shuffle(toneOptions, rng).slice(0, Math.ceil(count * 0.67)), ...shuffle(soundOptions, rng), ...shuffle(toneOptions, rng)];
  const result: string[] = [];
  for (const option of ordered) {
    if (result.length >= count) break;
    if (!excluded.has(option.toLowerCase()) && !result.includes(option)) result.push(option);
  }
  return result;
}

/** Tone-pattern options such as "3-4": each distractor changes one syllable's tone. */
export function tonePatternDistractors(target: readonly Syllable[], count: number, rng: Rng): string[] {
  const answer = target.map((syllable) => syllable.tone).join('-');
  const options = new Set<string>();
  target.forEach((syllable, index) => {
    for (const tone of [1, 2, 3, 4]) {
      if (tone === syllable.tone) continue;
      options.add(target.map((item, i) => (i === index ? tone : item.tone)).join('-'));
    }
  });
  options.delete(answer);
  return shuffle([...options], rng).slice(0, count);
}

export const COMMON_CLASSIFIERS = [
  '个', '本', '张', '只', '条', '件', '辆', '杯', '位', '把', '块', '双', '次', '家', '支', '台', '节', '瓶', '碗', '首',
  '片', '口', '棵', '座', '封', '份', '场', '门', '匹', '头',
] as const;

export function classifierDistractors(correct: readonly string[], count: number, rng: Rng): string[] {
  return shuffle(
    COMMON_CLASSIFIERS.filter((classifier) => !correct.includes(classifier)),
    rng,
  ).slice(0, count);
}
