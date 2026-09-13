import { afterEach, describe, expect, it } from 'vitest';
import { HanziStepDB } from './db';
import { DEFAULT_SETTINGS, getSettings, normalizeSettings, SETTINGS_KEY, updateSettings } from './settings';

const opened: HanziStepDB[] = [];
function freshDb(): HanziStepDB {
  const database = new HanziStepDB(`settings-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  for (const database of opened.splice(0)) await database.delete();
});

describe('normalizeSettings', () => {
  it('fills defaults and drops invalid or unknown fields', () => {
    const settings = normalizeSettings({
      theme: 'light',
      newWordsPerDay: 999,
      dailyGoalXp: 120,
      enabledFacets: [],
      hskTrack: 'hsk2',
      somethingElse: true,
    });
    expect(settings.theme).toBe('light');
    expect(settings.hskTrack).toBe('hsk2');
    expect(settings.newWordsPerDay).toBe(DEFAULT_SETTINGS.newWordsPerDay);
    expect(settings.dailyGoalXp).toBe(DEFAULT_SETTINGS.dailyGoalXp);
    expect(settings.enabledFacets).toEqual(DEFAULT_SETTINGS.enabledFacets);
    expect(settings).not.toHaveProperty('somethingElse');
  });

  it('treats non-objects as empty', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('oops')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('settings persistence', () => {
  it('returns defaults for a new database', async () => {
    expect(await getSettings(freshDb())).toEqual(DEFAULT_SETTINGS);
  });

  it('merges patches, keeps other fields, and ignores invalid values', async () => {
    const database = freshDb();
    await updateSettings({ theme: 'light', geminiApiKey: 'key-1' }, database);
    await updateSettings({ newWordsPerDay: 8, dayStartHour: 42 }, database);
    const settings = await getSettings(database);
    expect(settings.theme).toBe('light');
    expect(settings.geminiApiKey).toBe('key-1');
    expect(settings.newWordsPerDay).toBe(8);
    expect(settings.dayStartHour).toBe(0);
    expect((await database.kv.get(SETTINGS_KEY))?.value).toEqual(settings);
  });
});
