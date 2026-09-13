import { describe, expect, it } from 'vitest';
import { backupFileName, REMIND_AFTER_DAYS, shouldRemind } from './autoBackup';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 12, 10);

describe('backupFileName', () => {
  it('uses the local date, zero padded', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('hanzistep-backup-2026-01-05.json');
    expect(backupFileName(new Date(2026, 11, 31))).toBe('hanzistep-backup-2026-12-31.json');
  });
});

describe('shouldRemind', () => {
  it('reminds when there has never been a backup', () => {
    expect(shouldRemind(null, NOW)).toBe(true);
  });

  it('stays quiet inside the week', () => {
    expect(shouldRemind(NOW - DAY, NOW)).toBe(false);
    expect(shouldRemind(NOW - (REMIND_AFTER_DAYS - 1) * DAY, NOW)).toBe(false);
  });

  it('reminds once the week has passed', () => {
    expect(shouldRemind(NOW - REMIND_AFTER_DAYS * DAY, NOW)).toBe(true);
    expect(shouldRemind(NOW - 30 * DAY, NOW)).toBe(true);
  });

  it('honours a different interval', () => {
    expect(shouldRemind(NOW - 2 * DAY, NOW, 1)).toBe(true);
    expect(shouldRemind(NOW - 2 * DAY, NOW, 30)).toBe(false);
  });
});
