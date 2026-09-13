import { stripToneMarks } from './marks';

/** Search key without tones or spaces: "Nǐ hǎo", "ni3 hao3" → "nihao"; ü (also "u:", "v") → "v". */
export function tonelessKey(pinyin: string): string {
  return stripToneMarks(pinyin)
    .toLowerCase()
    .replace(/u:|ü/g, 'v')
    .replace(/[^a-z]/g, '');
}
