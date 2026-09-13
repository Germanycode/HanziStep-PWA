import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import type { Settings } from '@/domain/types';
import { db, type HanziStepDB } from './db';

export const SETTINGS_KEY = 'settings';

/** Never written to backups unless the user explicitly asks. */
export const SECRET_SETTING_KEYS = ['geminiApiKey', 'pixabayApiKey', 'unsplashApiKey'] as const satisfies readonly (keyof Settings)[];

export const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  pixabayApiKey: '',
  unsplashApiKey: '',
  geminiTextModel: 'gemini-2.5-flash',
  // Same Live model the English extension uses today (review.js:38).
  geminiLiveModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
  geminiTtsModel: 'gemini-2.5-flash-preview-tts',
  hskTrack: 'hsk3',
  currentLevel: 1,
  newWordsPerDay: 5,
  maxReviewsPerDay: 120,
  sessionSize: 25,
  dailyGoalXp: 150,
  dayStartHour: 0,
  enabledFacets: ['read', 'listen'],
  pinyinDisplay: 'all',
  toneColors: true,
  tonelessEasyMode: false,
  ttsVoiceURI: '',
  ttsRate: 0.85,
  theme: 'dark',
  musicTrack: 'default',
  musicVolume: 0.4,
  musicAutoplay: true,
  fontScale: 1,
  scheduler: 'sm2',
  dataVersion: 0,
  onboardingDone: false,
};

const settingsShape = {
  geminiApiKey: z.string().max(300),
  pixabayApiKey: z.string().max(300),
  unsplashApiKey: z.string().max(300),
  geminiTextModel: z.string().trim().min(1).max(120),
  geminiLiveModel: z.string().trim().min(1).max(120),
  geminiTtsModel: z.string().trim().min(1).max(120),
  hskTrack: z.enum(['hsk2', 'hsk3', 'hsk3-newest']),
  currentLevel: z.number().int().min(1).max(7),
  newWordsPerDay: z.number().int().min(0).max(50),
  maxReviewsPerDay: z.number().int().min(10).max(1000),
  sessionSize: z.number().int().min(5).max(100),
  dailyGoalXp: z.union([z.literal(50), z.literal(150), z.literal(300)]),
  dayStartHour: z.number().int().min(0).max(6),
  enabledFacets: z.array(z.enum(['read', 'listen', 'speak', 'write'])).min(1),
  pinyinDisplay: z.enum(['all', 'unknown', 'none']),
  toneColors: z.boolean(),
  tonelessEasyMode: z.boolean(),
  ttsVoiceURI: z.string().max(300),
  ttsRate: z.number().min(0.5).max(1.5),
  theme: z.enum(['dark', 'light']),
  musicTrack: z.string().min(1).max(60),
  musicVolume: z.number().min(0).max(1),
  musicAutoplay: z.boolean(),
  fontScale: z.number().min(0.8).max(1.6),
  scheduler: z.enum(['sm2', 'fsrs']),
  dataVersion: z.number().int().min(0),
  onboardingDone: z.boolean(),
} satisfies { [K in keyof Settings]: z.ZodType<Settings[K]> };

const SETTING_KEYS = Object.keys(settingsShape) as (keyof Settings)[];

/** Merges stored values over the defaults, keeping only fields that pass validation. */
export function normalizeSettings(raw: unknown): Settings {
  const source = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of SETTING_KEYS) {
    if (!(key in source)) continue;
    const parsed = settingsShape[key].safeParse(source[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result as unknown as Settings;
}

export async function getSettings(database: HanziStepDB = db): Promise<Settings> {
  const row = await database.kv.get(SETTINGS_KEY);
  return normalizeSettings(row?.value);
}

/** Applies a partial update atomically. Invalid values are ignored and the previous value is kept. */
export async function updateSettings(patch: Partial<Settings>, database: HanziStepDB = db): Promise<Settings> {
  return database.transaction('rw', database.kv, async () => {
    const current = normalizeSettings((await database.kv.get(SETTINGS_KEY))?.value);
    const next = normalizeSettings({ ...current, ...patch });
    await database.kv.put({ key: SETTINGS_KEY, value: next });
    return next;
  });
}

/** Live settings; returns the defaults until IndexedDB has answered. */
export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS);
}

/** Live settings, or `undefined` while loading (for code that must not act on defaults). */
export function useLoadedSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), []);
}
