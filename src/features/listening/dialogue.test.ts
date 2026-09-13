import { describe, expect, it } from 'vitest';
import { dialoguePrompt, dialogueRules, DIALOGUE_SCENES } from '@/services/ai/prompts/dialogue';
import { dialogueSentences, normalizeSpeaker, parseDialogue } from './dialogue';

describe('dialogue rules', () => {
  it('keeps turns short at low levels and grows with the level', () => {
    expect(dialogueRules(1)).toMatchObject({ maxTurns: 6, maxTurnChars: 10, answersInChinese: false });
    expect(dialogueRules(3)).toMatchObject({ maxTurns: 14, maxTurnChars: 18, answersInChinese: true });
    expect(dialogueRules(9)).toEqual(dialogueRules(4));
    expect(dialogueRules(2, true)).toMatchObject({ maxTurns: 4, maxTurnChars: 7 });
  });
});

describe('dialoguePrompt', () => {
  const prompt = dialoguePrompt({
    level: 1,
    rules: dialogueRules(1),
    scene: DIALOGUE_SCENES[0],
    allowed: ['你好', '谢谢'],
    micro: false,
  });

  it('asks for two speakers, short turns and a closed word list', () => {
    expect(prompt).toContain('2 người nói');
    expect(prompt).toContain('4–6 lượt');
    expect(prompt).toContain('tối đa 10 chữ Hán');
    expect(prompt).toContain('CHỈ dùng từ trong DANH SÁCH CHO PHÉP');
    expect(prompt).toContain('KHÔNG viết pinyin');
    expect(prompt).toContain('你好、谢谢');
  });

  it('asks for Vietnamese answers at HSK 1 and Chinese answers above', () => {
    expect(prompt).toContain('đáp án bằng tiếng Việt');
    expect(
      dialoguePrompt({ level: 3, rules: dialogueRules(3), scene: 'hỏi đường', allowed: [], micro: false }),
    ).toContain('đáp án bằng tiếng Trung');
  });
});

describe('speakers', () => {
  it('accepts A/B, 甲/乙 and alternates when the label is unclear', () => {
    expect(normalizeSpeaker('A：', undefined)).toBe('A');
    expect(normalizeSpeaker('乙', 'A')).toBe('B');
    expect(normalizeSpeaker('小明', 'A')).toBe('B');
    expect(normalizeSpeaker('小红', 'B')).toBe('A');
  });

  it('turns a dialogue into sentences that keep the speaker', () => {
    const dialogue = parseDialogue({
      titleZh: '在商店',
      titleVi: 'Ở cửa hàng',
      turns: [
        { speaker: 'A', zh: '你好！', vi: 'Xin chào!' },
        { speaker: '?', zh: '你好，你要什么？', vi: 'Chào, bạn muốn gì?' },
      ],
      questions: [],
    });
    expect(dialogueSentences(dialogue)).toEqual([
      { zh: '你好！', vi: 'Xin chào!', speaker: 'A' },
      { zh: '你好，你要什么？', vi: 'Chào, bạn muốn gì?', speaker: 'B' },
    ]);
  });

  it('rejects a dialogue with fewer than two turns', () => {
    expect(() => parseDialogue({ titleZh: 'a', titleVi: 'b', turns: [{ speaker: 'A', zh: '你好' }] })).toThrow();
  });
});
