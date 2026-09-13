import { describe, expect, it } from 'vitest';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { applySandhi } from '@/chinese/pinyin/sandhi';
import { toNumbered } from '@/chinese/pinyin/marks';
import { TOTAL_PINYIN_LESSONS } from '@/progress/recordActivity';
import { LESSONS } from './lessons';

describe('pinyin lessons', () => {
  it('matches the lesson count used by badges', () => {
    expect(LESSONS).toHaveLength(TOTAL_PINYIN_LESSONS);
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
  });

  it('gives every lesson enough Hanzi examples for the required checkpoint', () => {
    for (const lesson of LESSONS) {
      const choices = new Set(lesson.sections.flatMap((section) => section.examples ?? []).filter((example) => example.hanzi).map((example) => example.pinyin));
      expect(choices.size, lesson.id).toBeGreaterThanOrEqual(4);
    }
  });

  const examples = LESSONS.flatMap((lesson) =>
    lesson.sections.flatMap((section) => (section.examples ?? []).map((example) => ({ lesson: lesson.id, ...example }))),
  );

  it.each(examples)('$lesson: $pinyin parses cleanly and matches its characters', (example) => {
    const written = parsePinyin(example.pinyin);
    expect(written.errors).toEqual([]);
    if (example.hanzi) expect([...example.hanzi]).toHaveLength(written.syllables.length);
    if (example.spoken) {
      const spoken = parsePinyin(example.spoken);
      expect(spoken.errors).toEqual([]);
      // Spoken forms in the sandhi lesson must agree with the sandhi rules.
      expect(toNumbered(applySandhi(written.syllables, example.hanzi))).toBe(toNumbered(spoken.syllables));
    }
  });
});
