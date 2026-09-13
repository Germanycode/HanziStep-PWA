import { MAX_SYLLABLE_LENGTH, SYLLABLE_SET } from './syllables';
import type { PinyinTone, Syllable } from './types';

export interface ParseResult {
  syllables: Syllable[];
  /** Vietnamese messages for parts that could not be read as pinyin. */
  errors: string[];
  /** True when the input had at least one tone mark or tone number 1–4. */
  hasToneInfo: boolean;
}

/** Combining marks after NFD normalization. */
const COMBINING_TONE: Record<string, PinyinTone> = {
  '\u0304': 1, // macron  ā
  '\u0301': 2, // acute   á
  '\u030C': 3, // caron   ǎ
  '\u0300': 4, // grave   à
};
const COMBINING_DIAERESIS = '\u0308';

interface Letter {
  char: string;
  tone?: PinyinTone;
}

/** Longest-first segmentation with backtracking ("tiananmen" → tian an men). */
function segment(letters: string): string[] | null {
  const memo = new Map<number, string[] | null>();
  const solve = (start: number): string[] | null => {
    if (start === letters.length) return [];
    const cached = memo.get(start);
    if (cached !== undefined) return cached;
    for (let length = Math.min(MAX_SYLLABLE_LENGTH, letters.length - start); length >= 1; length--) {
      const piece = letters.slice(start, start + length);
      if (!SYLLABLE_SET.has(piece)) continue;
      const rest = solve(start + length);
      if (rest) {
        const result = [piece, ...rest];
        memo.set(start, result);
        return result;
      }
    }
    memo.set(start, null);
    return null;
  };
  return solve(0);
}

/** Splits a run of letters into syllables; `digitTone` applies to the last syllable. */
function readRun(run: Letter[], digitTone: PinyinTone | undefined, errors: string[], out: Syllable[]): boolean {
  if (run.length === 0) {
    if (digitTone !== undefined) errors.push('Số thanh điệu không đi kèm âm tiết.');
    return false;
  }
  // j/q/x/y + ü is written with a plain u (ju, qu, xu, yu).
  const letters = run.map((letter, index) =>
    letter.char === 'ü' && index > 0 && /[jqxy]/.test(run[index - 1]?.char ?? '') ? 'u' : letter.char,
  );
  const text = letters.join('');
  const pieces = segment(text);
  if (!pieces) {
    errors.push(`Không nhận ra “${text}” là pinyin.`);
    return false;
  }

  let hasTone = false;
  let offset = 0;
  pieces.forEach((base, index) => {
    const marks = run.slice(offset, offset + base.length).flatMap((letter) => (letter.tone ? [letter.tone] : []));
    offset += base.length;
    if (marks.length > 1) errors.push(`“${base}” có nhiều hơn một dấu thanh.`);
    let tone: PinyinTone = marks[0] ?? 5;
    if (index === pieces.length - 1 && digitTone !== undefined) {
      if (marks.length > 0 && marks[0] !== digitTone) errors.push(`“${base}” vừa có dấu vừa có số thanh khác nhau.`);
      tone = digitTone;
    }
    if (marks.length > 0 || (index === pieces.length - 1 && digitTone !== undefined && digitTone !== 5)) hasTone = true;
    out.push({ base, tone });
  });
  return hasTone;
}

/**
 * Reads pinyin typed in any common way: tone numbers ("ni3hao3", "ma0"),
 * tone marks ("nǐhǎo", also decomposed), ü as "ü", "v" or "u:", apostrophes
 * ("xi'an"), hyphens and spaces. Syllables without a tone are neutral (5).
 */
export function parsePinyin(input: string): ParseResult {
  const syllables: Syllable[] = [];
  const errors: string[] = [];
  let hasToneInfo = false;

  const normalized = input.toLowerCase().replace(/u:/g, 'ü').normalize('NFD');
  let run: Letter[] = [];

  const flush = (digitTone?: PinyinTone) => {
    if (run.length > 0 || digitTone !== undefined) {
      if (readRun(run, digitTone, errors, syllables)) hasToneInfo = true;
    }
    run = [];
  };

  for (const char of normalized) {
    if (char >= 'a' && char <= 'z') {
      run.push({ char: char === 'v' ? 'ü' : char });
    } else if (char === COMBINING_DIAERESIS) {
      const last = run[run.length - 1];
      if (last?.char === 'u') last.char = 'ü';
    } else if (char in COMBINING_TONE) {
      const last = run[run.length - 1];
      if (last) last.tone = COMBINING_TONE[char];
    } else if (char >= '0' && char <= '5') {
      flush(char === '0' ? 5 : (Number(char) as PinyinTone));
    } else {
      // Spaces, apostrophes, hyphens and punctuation separate syllables.
      flush();
    }
  }
  flush();

  return { syllables, errors, hasToneInfo };
}
