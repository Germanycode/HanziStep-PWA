/** Sentence splitting for Chinese text (used by the reader and the story checker). */

const ENDINGS = new Set(['。', '！', '？', '!', '?', '；', ';', '…', '\n']);
/** Quotes and brackets that belong to the sentence that just ended. */
const CLOSERS = new Set(['」', '』', '”', '"', '’', "'", '）', ')', '》', '〉', '】', ']', '…', '。']);
const SOFT_BREAKS = new Set(['，', ',', '、', '：', ':']);

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

function trimmedSpan(text: string, start: number, end: number): SentenceSpan | null {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from] ?? '')) from++;
  while (to > from && /\s/.test(text[to - 1] ?? '')) to--;
  return to > from ? { text: text.slice(from, to), start: from, end: to } : null;
}

/**
 * Splits on 。！？；… and line breaks, keeping the punctuation (and any closing
 * quote) with its sentence. Very long runs without an ending are cut at a comma
 * so pasted text without full stops still reads one line at a time.
 */
export function splitSentences(text: string, maxChars = 120): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let start = 0;

  const push = (from: number, to: number) => {
    const span = trimmedSpan(text, from, to);
    if (span) spans.push(span);
  };

  for (let index = 0; index < text.length; index++) {
    if (!ENDINGS.has(text[index] ?? '')) continue;
    let end = index + 1;
    while (end < text.length && CLOSERS.has(text[end] ?? '')) end++;
    push(start, end);
    start = end;
    index = end - 1;
  }
  push(start, text.length);

  return spans.flatMap((span) => (span.text.length > maxChars ? wrapLongSpan(text, span, maxChars) : [span]));
}

/** Cuts an over-long sentence after the last comma that fits. */
function wrapLongSpan(text: string, span: SentenceSpan, maxChars: number): SentenceSpan[] {
  const parts: SentenceSpan[] = [];
  let start = span.start;
  while (span.end - start > maxChars) {
    let cut = -1;
    for (let index = start + maxChars; index > start; index--) {
      if (SOFT_BREAKS.has(text[index - 1] ?? '')) {
        cut = index;
        break;
      }
    }
    if (cut <= start) cut = start + maxChars;
    const part = trimmedSpan(text, start, cut);
    if (part) parts.push(part);
    start = cut;
  }
  const rest = trimmedSpan(text, start, span.end);
  if (rest) parts.push(rest);
  return parts;
}
