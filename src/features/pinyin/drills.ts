import { syllableToMarks } from '@/chinese/pinyin/marks';
import { SYLLABLE_SET, SYLLABLES, syllableAudioKey } from '@/chinese/pinyin/syllables';
import type { PinyinTone, Syllable } from '@/chinese/pinyin/types';
import { hasRecording, type SyllableTable } from '@/data/syllables';
import { pickOne, shuffle, type Rng } from '@/lib/random';

export type DrillType = 'tone-id' | 'tone-pairs' | 'minimal-pairs' | 'pinyin-typing';

export interface DrillOption {
  id: string;
  label: string;
}

export interface DrillQuestion {
  /** Key in DrillStats.items. */
  key: string;
  /** What is played. */
  prompt: Syllable[];
  /** Choice drills. */
  options: DrillOption[];
  answerId?: string;
  /** Typing drill: the expected syllables. */
  expected?: Syllable[];
  isToneQuestion: boolean;
}

export interface DrillDefinition {
  type: DrillType;
  title: string;
  description: string;
}

export const DRILL_DEFINITIONS: readonly DrillDefinition[] = [
  { type: 'tone-id', title: 'Nhận diện thanh', description: 'Nghe một âm tiết và chọn thanh 1–4.' },
  { type: 'tone-pairs', title: '20 cặp thanh', description: 'Nghe hai âm tiết liền nhau và chọn đúng cặp thanh.' },
  { type: 'minimal-pairs', title: 'Cặp âm dễ nhầm', description: 'zh/z, an/ang, in/ing, n/l, u/ü… nghe và chọn cách viết đúng.' },
  { type: 'pinyin-typing', title: 'Nghe và gõ pinyin', description: 'Nghe một âm tiết rồi gõ pinyin kèm số thanh (ví dụ ma3).' },
];

export function findDrill(type: string): DrillDefinition | undefined {
  return DRILL_DEFINITIONS.find((drill) => drill.type === type);
}

/** Beginner-friendly syllables used for single-syllable tone questions. */
const COMMON_SYLLABLES = [
  'ma', 'ba', 'pa', 'da', 'ta', 'na', 'la', 'ha', 'ni', 'li', 'mi', 'bi', 'di', 'ti', 'ji', 'qi', 'xi', 'yi', 'wu',
  'yu', 'hu', 'shu', 'zhu', 'chu', 'wo', 'bo', 'po', 'mo', 'gu', 'ku', 'mu', 'lu', 'du', 'tu', 'fu', 'bu', 'hao',
  'mao', 'dao', 'tao', 'lao', 'bao', 'shi', 'zhi', 'chi', 'wan', 'yan', 'fang', 'tang', 'ying', 'yang', 'guo',
  'tian', 'jia', 'xiao', 'wen', 'ren', 'shan', 'bai', 'mai', 'lai', 'hai',
];

const TONE_LABELS: Record<number, string> = {
  1: 'Thanh 1 ¯',
  2: 'Thanh 2 ˊ',
  3: 'Thanh 3 ˇ',
  4: 'Thanh 4 ˋ',
  5: 'Thanh nhẹ',
};

interface Contrast {
  id: string;
  label: string;
  pairs: [string, string][];
}

const INITIALS = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];

function initialPairs(a: string, b: string): [string, string][] {
  return SYLLABLES.filter((syllable) => {
    if (!syllable.startsWith(a)) return false;
    // "z" must not match "zh…", and so on.
    return !(a.length === 1 && INITIALS.includes(syllable.slice(0, 2)));
  })
    .map((syllable): [string, string] => [syllable, b + syllable.slice(a.length)])
    .filter(([, other]) => SYLLABLE_SET.has(other));
}

function finalPairs(a: string, b: string): [string, string][] {
  return SYLLABLES.filter((syllable) => syllable.endsWith(a) && INITIALS.concat('').includes(syllable.slice(0, -a.length)))
    .map((syllable): [string, string] => [syllable, syllable.slice(0, -a.length) + b])
    .filter(([, other]) => SYLLABLE_SET.has(other));
}

export const CONTRASTS: readonly Contrast[] = [
  { id: 'zh-z', label: 'zh / z', pairs: initialPairs('zh', 'z') },
  { id: 'ch-c', label: 'ch / c', pairs: initialPairs('ch', 'c') },
  { id: 'sh-s', label: 'sh / s', pairs: initialPairs('sh', 's') },
  { id: 'n-l', label: 'n / l', pairs: initialPairs('n', 'l') },
  { id: 'b-p', label: 'b / p', pairs: initialPairs('b', 'p') },
  { id: 'd-t', label: 'd / t', pairs: initialPairs('d', 't') },
  { id: 'g-k', label: 'g / k', pairs: initialPairs('g', 'k') },
  {
    id: 'jqx-zhchsh',
    label: 'j q x / zh ch sh',
    pairs: [
      ['ji', 'zhi'],
      ['qi', 'chi'],
      ['xi', 'shi'],
      ['ju', 'zhu'],
      ['qu', 'chu'],
      ['xu', 'shu'],
    ],
  },
  { id: 'an-ang', label: 'an / ang', pairs: finalPairs('an', 'ang').filter(([a]) => !/[iu]an$/.test(a)) },
  { id: 'en-eng', label: 'en / eng', pairs: finalPairs('en', 'eng') },
  { id: 'in-ing', label: 'in / ing', pairs: finalPairs('in', 'ing') },
  { id: 'ian-iang', label: 'ian / iang', pairs: finalPairs('ian', 'iang') },
  { id: 'uan-uang', label: 'uan / uang', pairs: finalPairs('uan', 'uang') },
  {
    id: 'u-ü',
    label: 'u / ü',
    pairs: [
      ['nu', 'nü'],
      ['lu', 'lü'],
    ],
  },
];

function recordedTones(table: SyllableTable, base: string, tones: readonly number[]): PinyinTone[] {
  return tones.filter((tone) => hasRecording(table, syllableAudioKey(base), tone)) as PinyinTone[];
}

/** All item keys a drill can ask about (only items that have recordings). */
export function drillItemKeys(type: DrillType, table: SyllableTable): string[] {
  switch (type) {
    case 'tone-id':
    case 'pinyin-typing':
      return [1, 2, 3, 4]
        .filter((tone) => COMMON_SYLLABLES.some((base) => hasRecording(table, syllableAudioKey(base), tone)))
        .map((tone) => `${type === 'tone-id' ? 'tone' : 'type'}:${tone}`);
    case 'tone-pairs': {
      const keys: string[] = [];
      for (let first = 1; first <= 4; first++) {
        for (let second = 1; second <= 5; second++) keys.push(`pair:${first}-${second}`);
      }
      return keys;
    }
    case 'minimal-pairs':
      return CONTRASTS.filter((contrast) =>
        contrast.pairs.some(([a, b]) => recordedTones(table, a, [1, 2, 3, 4]).some((tone) => hasRecording(table, syllableAudioKey(b), tone))),
      ).map((contrast) => `minimal:${contrast.id}`);
  }
}

function randomSyllableWithTone(table: SyllableTable, tone: PinyinTone, rng: Rng, pool: readonly string[] = COMMON_SYLLABLES): Syllable {
  const candidates = pool.filter((base) => hasRecording(table, syllableAudioKey(base), tone));
  const base = pickOne(candidates, rng);
  if (!base) throw new Error(`Không có bản ghi cho thanh ${tone}.`);
  return { base, tone };
}

function parseKeyNumber(key: string, prefix: string): number {
  return Number(key.slice(prefix.length));
}

/** Builds the concrete question for an item key. */
export function makeQuestion(type: DrillType, key: string, table: SyllableTable, rng: Rng): DrillQuestion {
  switch (type) {
    case 'tone-id': {
      const tone = parseKeyNumber(key, 'tone:') as PinyinTone;
      const syllable = randomSyllableWithTone(table, tone, rng);
      return {
        key,
        prompt: [syllable],
        options: [1, 2, 3, 4].map((value) => ({ id: String(value), label: TONE_LABELS[value] ?? String(value) })),
        answerId: String(tone),
        isToneQuestion: true,
      };
    }

    case 'pinyin-typing': {
      const tone = parseKeyNumber(key, 'type:') as PinyinTone;
      const syllable = randomSyllableWithTone(table, tone, rng);
      return { key, prompt: [syllable], options: [], expected: [syllable], isToneQuestion: true };
    }

    case 'tone-pairs': {
      const [first, second] = key.slice('pair:'.length).split('-').map(Number) as [PinyinTone, PinyinTone];
      const pairPool = [...table.values()].map((info) => info.key.replace(/v/g, 'ü')).filter((base) => SYLLABLE_SET.has(base));
      const prompt = [
        randomSyllableWithTone(table, first, rng),
        randomSyllableWithTone(table, second, rng, second === 5 ? pairPool : COMMON_SYLLABLES),
      ];
      const answerId = `${first}-${second}`;
      // Distractors share one tone with the answer, which makes them genuinely confusable.
      const confusable = shuffle(
        [1, 2, 3, 4].flatMap((a) => [1, 2, 3, 4, 5].map((b) => `${a}-${b}`)).filter((id) => {
          if (id === answerId) return false;
          const [a, b] = id.split('-').map(Number);
          return a === first || b === second;
        }),
        rng,
      ).slice(0, 3);
      const options = shuffle([answerId, ...confusable], rng).map((id) => {
        const [a, b] = id.split('-');
        return { id, label: `${a === '5' ? 'nhẹ' : a} + ${b === '5' ? 'nhẹ' : b}` };
      });
      return { key, prompt, options, answerId, isToneQuestion: true };
    }

    case 'minimal-pairs': {
      const contrast = CONTRASTS.find((item) => `minimal:${item.id}` === key);
      if (!contrast) throw new Error(`Unknown contrast ${key}`);
      const playable = contrast.pairs.flatMap(([a, b]) =>
        recordedTones(table, a, [1, 2, 3, 4])
          .filter((tone) => hasRecording(table, syllableAudioKey(b), tone))
          .map((tone) => ({ a, b, tone })),
      );
      const choice = pickOne(playable, rng);
      if (!choice) throw new Error(`Không có bản ghi cho ${contrast.label}.`);
      const [played, other] = rng() < 0.5 ? [choice.a, choice.b] : [choice.b, choice.a];
      const options = shuffle([played, other], rng).map((base) => ({
        id: base,
        label: syllableToMarks({ base, tone: choice.tone }),
      }));
      return { key, prompt: [{ base: played, tone: choice.tone }], options, answerId: played, isToneQuestion: false };
    }
  }
}
