/**
 * Local calendar day keys ("YYYY-MM-DD").
 *
 * The English app used `new Date().toISOString().slice(0, 10)`, which is a UTC
 * date: at UTC+7 a new day started at 07:00 local time. Everything here uses
 * local calendar fields instead, and day arithmetic runs on UTC midnights so
 * DST changes can never produce fractional days.
 */

export type DayKey = string;

const DAY_MS = 86_400_000;
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Local day for a moment. With `dayStartHour` = 3, activity at 02:30 still
 * counts for the previous day (useful for late-night study sessions).
 */
export function toDayKey(date: Date | number = Date.now(), dayStartHour = 0): DayKey {
  const local = new Date(typeof date === 'number' ? date : date.getTime());
  if (dayStartHour !== 0) local.setHours(local.getHours() - dayStartHour);
  return `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`;
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const match = DAY_KEY_RE.exec(key);
  if (!match) throw new Error(`Invalid day key: ${key}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error(`Invalid day key: ${key}`);
  }
  return { year, month, day };
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string') return false;
  try {
    parseDayKey(value);
    return true;
  } catch {
    return false;
  }
}

function toUtcMidnight(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMidnight(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Whole days from `from` to `to`; positive when `to` is later. */
export function dayDiff(from: DayKey, to: DayKey): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

export function addDays(key: DayKey, days: number): DayKey {
  return fromUtcMidnight(toUtcMidnight(key) + days * DAY_MS);
}

/** The `count` days ending at `today`, oldest first. */
export function lastNDays(today: DayKey, count: number): DayKey[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => addDays(today, index - count + 1));
}
