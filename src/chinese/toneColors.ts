import type { PinyinTone } from './pinyin/types';

/** Full class names so Tailwind can see them (dynamic `text-tone-${n}` would be purged). */
export const TONE_TEXT_CLASS: Record<PinyinTone, string> = {
  1: 'text-tone-1',
  2: 'text-tone-2',
  3: 'text-tone-3',
  4: 'text-tone-4',
  5: 'text-tone-5',
};

export const TONE_BG_CLASS: Record<PinyinTone, string> = {
  1: 'bg-tone-1',
  2: 'bg-tone-2',
  3: 'bg-tone-3',
  4: 'bg-tone-4',
  5: 'bg-tone-5',
};

/** Vietnamese names and a rough comparison with Vietnamese tones, used in lessons and feedback. */
export const TONE_INFO: Record<PinyinTone, { name: string; shape: string; hint: string }> = {
  1: { name: 'Thanh 1', shape: 'cao, ngang', hint: 'Giữ giọng cao và đều như thanh ngang nhưng cao hơn.' },
  2: { name: 'Thanh 2', shape: 'đi lên', hint: 'Giọng đi lên như dấu sắc, như khi hỏi lại “hả?”.' },
  3: { name: 'Thanh 3', shape: 'xuống rồi lên', hint: 'Hạ giọng thấp rồi nâng lên, gần giống dấu hỏi.' },
  4: { name: 'Thanh 4', shape: 'đi xuống mạnh', hint: 'Từ cao rơi dứt khoát xuống thấp, gần giống dấu huyền nhưng mạnh và nhanh.' },
  5: { name: 'Thanh nhẹ', shape: 'ngắn, nhẹ', hint: 'Đọc ngắn và nhẹ, cao độ phụ thuộc âm tiết đứng trước.' },
};
