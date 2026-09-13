/** Parses kVietnamese rows of Unihan_Readings.txt ("U+4E2D\tkVietnamese\ttrung"). */
export function parseUnihanVietnamese(text: string): Map<string, string[]> {
  const readings = new Map<string, string[]>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [code, field, value] = line.split('\t');
    if (field !== 'kVietnamese' || !code?.startsWith('U+') || !value) continue;
    const char = String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    readings.set(char, value.trim().split(/\s+/));
  }
  return readings;
}
