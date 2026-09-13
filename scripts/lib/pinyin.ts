/** Canonical join key for numbered pinyin: lowercase, ü as "v", single spaces. */
export function pinyinKey(pinyin: string): string {
  return pinyin.toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v').replace(/\s+/g, ' ').trim();
}

/** "yin2 hang2" → "yinhang" (for search). */
export function tonelessKey(pinyin: string): string {
  return pinyinKey(pinyin).replace(/[^a-z]/g, '');
}

/** Longest initials first so "zh" wins over "z". y/w are spelling initials, kept for display. */
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

export function splitSyllable(syllable: string): { initial: string; final: string } {
  const lower = syllable.toLowerCase();
  for (const initial of INITIALS) {
    if (lower.startsWith(initial) && lower.length > initial.length) {
      return { initial, final: lower.slice(initial.length) };
    }
  }
  return { initial: '', final: lower };
}
