import { fetchWithTimeout } from '@/lib/http';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string };
}

export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface GenerateOptions {
  apiKey: string;
  model: string;
  prompt: string;
  /** OpenAPI-style schema; the answer is then JSON only. */
  schema?: Record<string, unknown>;
  /** A recording to send with the prompt (pronunciation feedback). */
  audio?: { mimeType: string; dataBase64: string };
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function friendlyError(status: number, message?: string): string {
  if (status === 400) return 'Gemini từ chối yêu cầu (kiểm tra tên model trong Cài đặt).';
  if (status === 401 || status === 403) return 'API key Gemini không hợp lệ hoặc chưa được bật.';
  if (status === 429) return 'Đã vượt hạn mức Gemini, thử lại sau vài phút.';
  if (status >= 500) return 'Máy chủ Gemini đang lỗi, thử lại sau.';
  return message ?? `Gemini trả về lỗi ${status}.`;
}

/** One Gemini text request. The key goes in the `x-goog-api-key` header, never in the URL. */
export async function generateText(options: GenerateOptions): Promise<string> {
  const key = options.apiKey.trim();
  if (!key) throw new GeminiError('Chưa có API key Gemini trong Cài đặt.');

  const response = await fetchWithTimeout(
    `${ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: options.audio
              ? [{ text: options.prompt }, { inlineData: { mimeType: options.audio.mimeType, data: options.audio.dataBase64 } }]
              : [{ text: options.prompt }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.4,
          ...(options.schema ? { responseMimeType: 'application/json', responseSchema: options.schema } : {}),
        },
      }),
      signal: options.signal,
    },
    options.timeoutMs ?? 20_000,
  );

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;
  if (!response.ok) throw new GeminiError(friendlyError(response.status, data.error?.message));
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim();
  if (!text) throw new GeminiError('Gemini không trả về nội dung.');
  return text;
}

export async function generateJson<T>(options: GenerateOptions): Promise<T> {
  const text = await generateText(options);
  try {
    return JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()) as T;
  } catch {
    throw new GeminiError('Gemini trả về dữ liệu không đọc được.');
  }
}

export interface PronunciationNote {
  expected: string;
  ok: boolean;
  noteVi: string;
}

export interface PronunciationFeedback {
  syllables: PronunciationNote[];
  feedbackVi: string;
}

const PRONUNCIATION_SCHEMA = {
  type: 'object',
  properties: {
    syllables: {
      type: 'array',
      items: {
        type: 'object',
        properties: { expected: { type: 'string' }, ok: { type: 'boolean' }, noteVi: { type: 'string' } },
        required: ['expected', 'ok', 'noteVi'],
      },
    },
    feedbackVi: { type: 'string' },
  },
  required: ['syllables', 'feedbackVi'],
} satisfies Record<string, unknown>;

/**
 * Optional pronunciation notes on a recording. This is an AI opinion, shown as
 * such, and it never feeds the SRS (docs/PLAN.md §8.4).
 */
export async function gradePronunciation(input: {
  apiKey: string;
  model: string;
  hanzi: string;
  pinyinNum: string;
  audio: { mimeType: string; dataBase64: string };
  signal?: AbortSignal;
}): Promise<PronunciationFeedback> {
  const raw = await generateJson<Partial<PronunciationFeedback>>({
    apiKey: input.apiKey,
    model: input.model,
    audio: input.audio,
    temperature: 0.2,
    signal: input.signal,
    timeoutMs: 45_000,
    prompt: [
      'Bạn là giáo viên phát âm tiếng Trung cho người Việt.',
      `Học viên vừa đọc từ "${input.hanzi}" (pinyin đúng: ${input.pinyinNum}). File ghi âm đính kèm.`,
      'Với TỪNG âm tiết, cho biết nghe có đúng không và một ghi chú ngắn bằng tiếng Việt (âm đầu, vần, thanh điệu).',
      'feedbackVi: một câu nhận xét chung, thân thiện.',
      'Nếu bản ghi quá nhỏ hoặc quá nhiễu, hãy nói rõ là không nghe được thay vì đoán.',
    ].join('\n'),
    schema: PRONUNCIATION_SCHEMA,
  });
  return {
    syllables: Array.isArray(raw.syllables)
      ? raw.syllables.map((note) => ({
          expected: String(note.expected ?? ''),
          ok: Boolean(note.ok),
          noteVi: String(note.noteVi ?? ''),
        }))
      : [],
    feedbackVi: typeof raw.feedbackVi === 'string' ? raw.feedbackVi : '',
  };
}

export interface SentenceGrade {
  /** 0–1; below 0.6 counts as wrong (docs/PLAN.md §5.3). */
  score: number;
  feedbackVi: string;
  corrected: string;
}

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    feedbackVi: { type: 'string' },
    corrected: { type: 'string' },
  },
  required: ['score', 'feedbackVi', 'corrected'],
} satisfies Record<string, unknown>;

/** Grades a beginner's sentence that must use a given word. */
export async function gradeSentenceUse(input: {
  apiKey: string;
  model: string;
  word: { simplified: string; pinyinNum: string; meaningVi: string[] };
  sentence: string;
  signal?: AbortSignal;
}): Promise<SentenceGrade> {
  const prompt = [
    'Bạn là giáo viên tiếng Trung dạy người Việt mới bắt đầu (trình độ HSK 1–3).',
    `Học viên phải đặt MỘT câu tiếng Trung dùng từ "${input.word.simplified}" (${input.word.pinyinNum}, nghĩa: ${input.word.meaningVi.slice(0, 2).join('; ')}).`,
    `Câu của học viên: "${input.sentence}"`,
    'Chấm theo thang 0–1: 1 là câu đúng ngữ pháp và dùng đúng từ; 0.6–0.9 là hiểu được nhưng còn lỗi nhỏ; dưới 0.6 là sai nghĩa, sai ngữ pháp nặng hoặc không dùng từ đã cho.',
    'feedbackVi: nhận xét ngắn bằng tiếng Việt (tối đa 2 câu), nói rõ lỗi nếu có.',
    'corrected: câu tiếng Trung đã sửa (nếu câu đã đúng thì chép lại nguyên câu).',
  ].join('\n');

  const raw = await generateJson<Partial<SentenceGrade>>({
    apiKey: input.apiKey,
    model: input.model,
    prompt,
    schema: GRADE_SCHEMA,
    temperature: 0.2,
    signal: input.signal,
  });
  return {
    score: Math.min(1, Math.max(0, Number(raw.score) || 0)),
    feedbackVi: typeof raw.feedbackVi === 'string' ? raw.feedbackVi : '',
    corrected: typeof raw.corrected === 'string' ? raw.corrected : '',
  };
}
