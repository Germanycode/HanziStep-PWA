import type { StreakInfo } from './streak';

export interface BadgeContext {
  words: number;
  masteredWords: number;
  totalReviews: number;
  taggedWords: number;
  streak: StreakInfo;
  level: number;
  pinyinLessonsCompleted: number;
  totalPinyinLessons: number;
  toneCorrectTotal: number;
  /** Accuracy over the last 100 tone answers, or null with fewer than 100 answers. */
  toneRecentAccuracy: number | null;
  storiesCreated: number;
  textsRead: number;
  speakingAttempts: number;
  coachSessions: number;
  hsk1Complete: boolean;
}

export interface BadgeDefinition {
  id: string;
  icon: string;
  title: string;
  description: string;
  check: (context: BadgeContext) => boolean;
}

const bestStreak = (context: BadgeContext) => Math.max(context.streak.current, context.streak.longest);

/** Ids shared with the English extension keep their meaning (first_word, streak_3, …). */
export const BADGES: readonly BadgeDefinition[] = [
  { id: 'first_word', icon: '🌱', title: 'Bước đầu tiên', description: 'Lưu từ vựng đầu tiên', check: (c) => c.words >= 1 },
  { id: 'vocab_50', icon: '📚', title: 'Nhà sưu tầm', description: 'Có 50 từ vựng', check: (c) => c.words >= 50 },
  { id: 'vocab_150', icon: '📖', title: 'Vốn từ HSK 1', description: 'Có 150 từ — bằng HSK 2.0 cấp 1', check: (c) => c.words >= 150 },
  { id: 'vocab_500', icon: '🏛️', title: 'Kho 500 từ', description: 'Có 500 từ — bằng HSK 3.0 cấp 1', check: (c) => c.words >= 500 },
  { id: 'streak_3', icon: '🔥', title: 'Tạo thói quen', description: 'Học 3 ngày liên tiếp', check: (c) => bestStreak(c) >= 3 },
  { id: 'streak_7', icon: '⚡', title: 'Ngọn lửa bền bỉ', description: 'Học 7 ngày liên tiếp', check: (c) => bestStreak(c) >= 7 },
  { id: 'streak_30', icon: '🌋', title: 'Kiên trì 30 ngày', description: 'Học 30 ngày liên tiếp', check: (c) => bestStreak(c) >= 30 },
  { id: 'master_20', icon: '⭐', title: 'Thành thạo 20 từ', description: '20 từ đạt mức Thành thạo', check: (c) => c.masteredWords >= 20 },
  { id: 'master_100', icon: '👑', title: 'Thành thạo 100 từ', description: '100 từ đạt mức Thành thạo', check: (c) => c.masteredWords >= 100 },
  { id: 'review_100', icon: '🎯', title: 'Trăm lượt ôn', description: 'Trả lời 100 câu ôn tập', check: (c) => c.totalReviews >= 100 },
  { id: 'review_1000', icon: '🏆', title: 'Nghìn lượt ôn', description: 'Trả lời 1000 câu ôn tập', check: (c) => c.totalReviews >= 1000 },
  { id: 'tagger', icon: '🏷️', title: 'Người sắp xếp', description: 'Gắn tag cho từ vựng', check: (c) => c.taggedWords >= 1 },
  { id: 'level_5', icon: '🚀', title: 'Cống sĩ', description: 'Đạt level 5', check: (c) => c.level >= 5 },
  {
    id: 'pinyin_graduate',
    icon: '🎓',
    title: 'Tốt nghiệp pinyin',
    description: 'Hoàn thành tất cả bài học pinyin',
    check: (c) => c.totalPinyinLessons > 0 && c.pinyinLessonsCompleted >= c.totalPinyinLessons,
  },
  {
    id: 'tone_ear',
    icon: '👂',
    title: 'Đôi tai thanh điệu',
    description: '200 câu thanh điệu đúng, đạt ≥ 85% trong 100 câu gần nhất',
    check: (c) => c.toneCorrectTotal >= 200 && (c.toneRecentAccuracy ?? 0) >= 0.85,
  },
  { id: 'first_story', icon: '📜', title: 'Truyện đầu tiên', description: 'Tạo truyện đọc đầu tiên', check: (c) => c.storiesCreated >= 1 },
  { id: 'reader_20', icon: '📰', title: 'Người ham đọc', description: 'Đọc hết 20 bài', check: (c) => c.textsRead >= 20 },
  { id: 'first_voice', icon: '🎙️', title: 'Cất tiếng', description: 'Luyện nói 20 lượt', check: (c) => c.speakingAttempts >= 20 },
  { id: 'coach_first', icon: '🤖', title: 'Gặp thầy AI', description: 'Trò chuyện với AI Coach', check: (c) => c.coachSessions >= 1 },
  { id: 'hsk1_done', icon: '🥇', title: 'Xong HSK 1', description: 'Học hết từ vựng HSK cấp 1', check: (c) => c.hsk1Complete },
];

export function newlyUnlockedBadges(unlocked: readonly string[], context: BadgeContext): string[] {
  const owned = new Set(unlocked);
  return BADGES.filter((badge) => !owned.has(badge.id) && badge.check(context)).map((badge) => badge.id);
}

export function findBadge(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id);
}
