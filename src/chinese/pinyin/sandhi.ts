import { toNumbered } from './marks';
import type { Syllable } from './types';

/**
 * Spoken tone changes:
 * - two third tones in a row: the first becomes second (你好 nǐ hǎo → ní hǎo; runs 我很好 → wó hén hǎo);
 * - 不 bù becomes bú before a fourth tone (不是 bú shì);
 * - 一 yī becomes yí before a fourth tone and yì before tones 1–3 (一个 yí gè, 一天 yì tiān).
 * The 不/一 rules need the characters (`hanzi` aligned with the syllables).
 */
export function applySandhi(syllables: readonly Syllable[], hanzi?: string): Syllable[] {
  const result = syllables.map((syllable) => ({ ...syllable }));
  const chars = hanzi ? [...hanzi] : [];
  const aligned = chars.length === syllables.length;

  for (let index = 0; index < syllables.length - 1; index++) {
    const current = syllables[index];
    const next = syllables[index + 1];
    const target = result[index];
    if (!current || !next || !target) continue;

    if (current.tone === 3 && next.tone === 3) {
      target.tone = 2;
    } else if (aligned && chars[index] === '不' && current.base === 'bu' && current.tone === 4 && next.tone === 4) {
      target.tone = 2;
    } else if (aligned && chars[index] === '一' && current.base === 'yi' && current.tone === 1) {
      if (next.tone === 4) target.tone = 2;
      else if (next.tone >= 1 && next.tone <= 3) target.tone = 4;
    }
  }
  return result;
}

/** Citation reading plus the sandhi reading when it differs (both are accepted as answers). */
export function acceptedReadings(citation: readonly Syllable[], hanzi?: string): Syllable[][] {
  const spoken = applySandhi(citation, hanzi);
  const readings = [citation.map((syllable) => ({ ...syllable }))];
  if (toNumbered(spoken) !== toNumbered(citation)) readings.push(spoken);
  return readings;
}
