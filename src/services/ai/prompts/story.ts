/** Story prompt and rules (docs/PLAN.md §7.4). */

export interface StoryRules {
  minChars: number;
  maxChars: number;
  minSentences: number;
  maxSentences: number;
  maxSentenceChars: number;
  maxTargets: number;
  /** Multiple-choice answers in Vietnamese at HSK 1, in Chinese above. */
  answersInChinese: boolean;
}

const RULES: Record<number, StoryRules> = {
  1: { minChars: 40, maxChars: 90, minSentences: 4, maxSentences: 8, maxSentenceChars: 12, maxTargets: 3, answersInChinese: false },
  2: { minChars: 90, maxChars: 180, minSentences: 6, maxSentences: 12, maxSentenceChars: 16, maxTargets: 5, answersInChinese: true },
  3: { minChars: 180, maxChars: 350, minSentences: 10, maxSentences: 18, maxSentenceChars: 22, maxTargets: 6, answersInChinese: true },
  4: { minChars: 350, maxChars: 600, minSentences: 14, maxSentences: 24, maxSentenceChars: 28, maxTargets: 7, answersInChinese: true },
};

/** First texts for a complete beginner: a few short sentences with full support. */
export const MICRO_RULES: StoryRules = {
  minChars: 12,
  maxChars: 40,
  minSentences: 2,
  maxSentences: 4,
  maxSentenceChars: 8,
  maxTargets: 2,
  answersInChinese: false,
};

export function storyRules(level: number, micro = false): StoryRules {
  if (micro) return MICRO_RULES;
  return RULES[Math.min(4, Math.max(1, Math.round(level)))] ?? RULES[1]!;
}

/** Coverage a story must reach before it is offered (docs/PLAN.md §7.4). */
export function coverageThreshold(level: number): number {
  return level <= 2 ? 0.95 : 0.92;
}

/** Names the model may use, so it cannot invent characters the learner has never seen. */
export const STORY_NAMES = ['小明', '小红', '小美', '大卫', '王老师', '李医生', '张先生', '妈妈', '爸爸', '朋友'] as const;

export const STORY_GENRES = ['đời thường', 'ở trường', 'đi chợ', 'gia đình', 'du lịch', 'nhà hàng', 'bệnh viện', 'công việc'] as const;

export const STORY_SCHEMA = {
  type: 'object',
  properties: {
    titleZh: { type: 'string' },
    titleVi: { type: 'string' },
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: { zh: { type: 'string' }, vi: { type: 'string' } },
        required: ['zh', 'vi'],
      },
    },
    targetWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { hanzi: { type: 'string' }, vi: { type: 'string' } },
        required: ['hanzi', 'vi'],
      },
    },
    names: { type: 'array', items: { type: 'string' } },
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
  required: ['titleZh', 'titleVi', 'sentences', 'questions'],
} satisfies Record<string, unknown>;

export interface StoryPromptInput {
  level: number;
  rules: StoryRules;
  genre: string;
  targets: readonly { hanzi: string; vi: string }[];
  /** Words the model may use, most frequent first. */
  allowed: readonly string[];
  micro: boolean;
}

/** The allowed list is capped so the prompt stays small (docs/PLAN.md §7.4). */
export const MAX_ALLOWED_WORDS = 400;

export function storyPrompt(input: StoryPromptInput): string {
  const { rules } = input;
  const allowed = input.allowed.slice(0, MAX_ALLOWED_WORDS);
  const targets = input.targets.map((target) => `${target.hanzi} (${target.vi})`).join('、') || 'không bắt buộc';
  return [
    `Bạn là giáo viên tiếng Trung, viết một bài đọc ngắn cho người Việt đang học HSK ${input.level}.`,
    '',
    'QUY TẮC BẮT BUỘC:',
    `- Viết ${rules.minSentences}–${rules.maxSentences} câu, tổng khoảng ${rules.minChars}–${rules.maxChars} chữ Hán.`,
    `- Mỗi câu tối đa ${rules.maxSentenceChars} chữ Hán.`,
    '- CHỈ dùng từ trong DANH SÁCH CHO PHÉP bên dưới và các TỪ MỤC TIÊU. Không dùng bất kỳ từ nào khác.',
    `- Tên riêng chỉ được lấy trong: ${STORY_NAMES.join('、')}.`,
    '- Dùng chữ giản thể. KHÔNG viết pinyin ở bất kỳ trường nào.',
    '- Mỗi câu kèm một bản dịch tiếng Việt tự nhiên.',
    input.micro ? '- Người đọc mới bắt đầu: câu càng ngắn càng tốt, chỉ kể một việc.' : `- Thể loại: ${input.genre}.`,
    '',
    `TỪ MỤC TIÊU (phải xuất hiện, tối đa ${rules.maxTargets} từ): ${targets}`,
    '',
    `CÂU HỎI ĐỌC HIỂU: 2 câu trắc nghiệm (4 lựa chọn, đáp án bằng ${
      rules.answersInChinese ? 'tiếng Trung' : 'tiếng Việt'
    }) và 1 câu trả lời ngắn. Trường answerZh là đáp án tiếng Trung, answerVi là đáp án tiếng Việt.`,
    '',
    `imageSearchKeywordsEn: 2–4 từ khoá tiếng Anh để tìm ảnh minh hoạ.`,
    '',
    `DANH SÁCH CHO PHÉP (${allowed.length} từ):`,
    allowed.join('、'),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Second attempt when the first story used words outside the list. */
export function retryPrompt(base: string, outside: readonly string[]): string {
  return [
    base,
    '',
    `LẦN TRƯỚC BẠN ĐÃ DÙNG CÁC TỪ NGOÀI DANH SÁCH: ${outside.slice(0, 30).join('、')}.`,
    'Hãy viết lại toàn bộ bài, thay những từ đó bằng từ có trong danh sách cho phép.',
  ].join('\n');
}
