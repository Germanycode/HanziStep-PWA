/** Two-speaker listening dialogues (docs/PLAN.md §8.3), built on the story rules. */

import { MAX_ALLOWED_WORDS, STORY_NAMES } from './story';

export interface DialogueRules {
  minTurns: number;
  maxTurns: number;
  maxTurnChars: number;
  answersInChinese: boolean;
}

const RULES: Record<number, DialogueRules> = {
  1: { minTurns: 4, maxTurns: 6, maxTurnChars: 10, answersInChinese: false },
  2: { minTurns: 6, maxTurns: 10, maxTurnChars: 14, answersInChinese: true },
  3: { minTurns: 8, maxTurns: 14, maxTurnChars: 18, answersInChinese: true },
  4: { minTurns: 10, maxTurns: 16, maxTurnChars: 24, answersInChinese: true },
};

/** Very first dialogues: a handful of short turns. */
export const MICRO_DIALOGUE: DialogueRules = { minTurns: 2, maxTurns: 4, maxTurnChars: 7, answersInChinese: false };

export function dialogueRules(level: number, micro = false): DialogueRules {
  if (micro) return MICRO_DIALOGUE;
  return RULES[Math.min(4, Math.max(1, Math.round(level)))] ?? RULES[1]!;
}

export const DIALOGUE_SCENES = [
  'chào hỏi làm quen',
  'gọi món ở quán ăn',
  'mua sắm, hỏi giá',
  'hỏi đường',
  'ở lớp học',
  'hỏi giờ, hẹn gặp',
  'gọi điện thoại',
  'ở bệnh viện',
] as const;

export const DIALOGUE_SCHEMA = {
  type: 'object',
  properties: {
    titleZh: { type: 'string' },
    titleVi: { type: 'string' },
    turns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['A', 'B'] },
          zh: { type: 'string' },
          vi: { type: 'string' },
        },
        required: ['speaker', 'zh', 'vi'],
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['mcq', 'short'] },
          qZh: { type: 'string' },
          qVi: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerZh: { type: 'string' },
          answerVi: { type: 'string' },
        },
        required: ['type', 'qZh', 'qVi', 'answerZh', 'answerVi'],
      },
    },
    imageSearchKeywordsEn: { type: 'string' },
  },
  required: ['titleZh', 'titleVi', 'turns', 'questions'],
} satisfies Record<string, unknown>;

export interface DialoguePromptInput {
  level: number;
  rules: DialogueRules;
  scene: string;
  allowed: readonly string[];
  micro: boolean;
}

export function dialoguePrompt(input: DialoguePromptInput): string {
  const { rules } = input;
  const allowed = input.allowed.slice(0, MAX_ALLOWED_WORDS);
  return [
    `Bạn là giáo viên tiếng Trung, viết một đoạn hội thoại ngắn để luyện NGHE cho người Việt học HSK ${input.level}.`,
    '',
    'QUY TẮC BẮT BUỘC:',
    `- Đúng 2 người nói, đánh dấu A và B, tổng ${rules.minTurns}–${rules.maxTurns} lượt, mỗi lượt tối đa ${rules.maxTurnChars} chữ Hán.`,
    '- CHỈ dùng từ trong DANH SÁCH CHO PHÉP. Không dùng từ nào khác.',
    `- Tên riêng chỉ lấy trong: ${STORY_NAMES.join('、')}.`,
    '- Dùng chữ giản thể, KHÔNG viết pinyin.',
    '- Mỗi lượt kèm bản dịch tiếng Việt tự nhiên.',
    '- Hội thoại phải nghe hiểu được mà không cần nhìn chữ: câu ngắn, ý rõ ràng.',
    input.micro ? '- Người học mới bắt đầu: chỉ một việc duy nhất, câu cực ngắn.' : `- Tình huống: ${input.scene}.`,
    '',
    `CÂU HỎI NGHE HIỂU: 2 câu trắc nghiệm (4 lựa chọn, đáp án bằng ${
      rules.answersInChinese ? 'tiếng Trung' : 'tiếng Việt'
    }) hỏi về thông tin nghe được, và 1 câu trả lời ngắn.`,
    '',
    'imageSearchKeywordsEn: 2–4 từ khoá tiếng Anh để tìm ảnh minh hoạ tình huống.',
    '',
    `DANH SÁCH CHO PHÉP (${allowed.length} từ):`,
    allowed.join('、'),
  ]
    .filter(Boolean)
    .join('\n');
}
