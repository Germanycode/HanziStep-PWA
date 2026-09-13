const LETTER_RE = /\p{L}/u;

function normalize(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}

/**
 * True when the word's Hán-Việt reading appears as whole words in one of its
 * Vietnamese meanings (注意 "CHÚ Ý" ↔ "chú ý đến"). Such words are easy wins
 * for Vietnamese learners and can be introduced first.
 */
export function isCognate(hanViet: string, meaningsVi: readonly string[]): boolean {
  const reading = normalize(hanViet);
  if (!reading || reading.includes('?') || reading.includes('/')) return false;
  return meaningsVi.some((meaning) => {
    const haystack = normalize(meaning);
    for (let index = haystack.indexOf(reading); index !== -1; index = haystack.indexOf(reading, index + 1)) {
      const before = haystack[index - 1];
      const after = haystack[index + reading.length];
      if (!(before && LETTER_RE.test(before)) && !(after && LETTER_RE.test(after))) return true;
    }
    return false;
  });
}
