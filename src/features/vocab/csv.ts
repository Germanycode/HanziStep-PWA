import { levelOf } from '@/data/hsk';
import type { HskTrackKey } from '@/data/types';
import type { Card, Word } from '@/domain/types';
import { masteryLabel } from '@/srs/cards';

/** Excel only reads UTF-8 CSV correctly with a byte-order mark. */
export const CSV_BOM = '﻿';
const LIST_SEPARATOR = '; ';

export const VOCAB_CSV_COLUMNS = [
  'Hanzi',
  'Traditional',
  'Pinyin',
  'HanViet',
  'MeaningVi',
  'MeaningEn',
  'PartOfSpeech',
  'Classifiers',
  'HskLevel',
  'HskTrack',
  'Tags',
  'Mastery',
  'Repetition',
  'EaseFactor',
  'IntervalDays',
  'Lapses',
  'DueAt',
  'CreatedAt',
  'Source',
] as const;

export function escapeCsvField(value: string): string {
  // Excel interprets these prefixes as formulas even in quoted CSV cells.
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 text with CRLF line endings and a BOM, so Excel keeps Vietnamese and Chinese characters. */
export function toCsv(rows: readonly (readonly string[])[], options: { bom?: boolean } = {}): string {
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
  return `${options.bom ?? true ? CSV_BOM : ''}${body}\r\n`;
}

/** Parses CSV with quoted fields, doubled quotes, CRLF or LF, and an optional BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let started = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = false;
      continue;
    }
    if (char === '"' && field === '') {
      quoted = true;
      started = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      started = true;
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      started = false;
    } else if (char !== '\r') {
      field += char;
      started = true;
    }
  }
  if (started || field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function list(values: readonly string[]): string {
  return values.join(LIST_SEPARATOR);
}

function splitList(value: string): string[] {
  return value
    .split(/[;,，；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function wordToCsvRow(word: Word, card: Card | undefined, track: HskTrackKey): string[] {
  const level = levelOf(word.hsk, track);
  return [
    word.simplified,
    word.traditional ?? '',
    word.pinyinNum,
    word.hanViet,
    list(word.meaningVi),
    list(word.meaningEn),
    list(word.pos),
    list(word.classifiers),
    level === undefined ? '' : String(level),
    track,
    list(word.tags),
    word.knownWithoutSrs ? 'Đã biết' : card ? masteryLabel(card.repetition) : 'Chưa học',
    card ? String(card.repetition) : '',
    card ? card.easeFactor.toFixed(2) : '',
    card ? String(card.intervalDays) : '',
    card ? String(card.lapses) : '',
    card ? new Date(card.due).toISOString() : '',
    new Date(word.createdAt).toISOString(),
    word.source,
  ];
}

export interface VocabCsvRow {
  simplified: string;
  traditional?: string;
  pinyinNum: string;
  hanViet: string;
  meaningVi: string[];
  meaningEn: string[];
  pos: string[];
  classifiers: string[];
  hskLevel?: number;
  hskTrack?: HskTrackKey;
  tags: string[];
  /** Scheduling from an export of this app; used when restoring a list. */
  schedule?: { repetition: number; easeFactor: number; intervalDays: number; lapses: number; due: number };
  createdAt?: number;
}

function numberOrUndefined(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function timeOrUndefined(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Reads a vocabulary CSV. Only the characters column is required, so lists
 * exported from other apps can be imported and enriched from the dictionary.
 */
export function parseVocabCsv(text: string): { rows: VocabCsvRow[]; errors: string[] } {
  const table = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''));
  const header = table[0];
  if (!header) return { rows: [], errors: ['Tệp CSV rỗng.'] };

  const columns = new Map(header.map((name, index) => [name.trim().toLowerCase().replace(/\s+/g, ''), index]));
  const at = (row: string[], name: string): string => {
    const index = columns.get(name.toLowerCase());
    const value = index === undefined ? '' : (row[index] ?? '').trim();
    return value.startsWith("'") && /^[\s]*[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value;
  };
  if (!columns.has('hanzi') && !columns.has('simplified') && !columns.has('word')) {
    return { rows: [], errors: ['Không tìm thấy cột "Hanzi". Hãy xuất một tệp mẫu để xem đúng định dạng.'] };
  }

  const rows: VocabCsvRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  table.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    const simplified = at(row, 'hanzi') || at(row, 'simplified') || at(row, 'word');
    if (!simplified) {
      errors.push(`Dòng ${line}: thiếu chữ Hán.`);
      return;
    }
    const pinyinNum = at(row, 'pinyin');
    const key = `${simplified}|${pinyinNum.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push(`Dòng ${line}: trùng với dòng trước (${simplified}).`);
      return;
    }
    seen.add(key);

    const repetition = numberOrUndefined(at(row, 'repetition'));
    const easeFactor = numberOrUndefined(at(row, 'easefactor'));
    const intervalDays = numberOrUndefined(at(row, 'intervaldays'));
    const due = timeOrUndefined(at(row, 'dueat'));
    const lapses = numberOrUndefined(at(row, 'lapses'));
    const hskLevel = numberOrUndefined(at(row, 'hsklevel'));
    const trackValue = at(row, 'hsktrack');
    const hskTrack = (['hsk2', 'hsk3', 'hsk3-newest'] as const).find((track) => track === trackValue);
    const invalidSchedule =
      (repetition !== undefined && (!Number.isInteger(repetition) || repetition < 0)) ||
      (intervalDays !== undefined && (intervalDays < 0 || intervalDays > 365)) ||
      (easeFactor !== undefined && (easeFactor < 1.3 || easeFactor > 5)) ||
      (lapses !== undefined && (!Number.isInteger(lapses) || lapses < 0));
    if (invalidSchedule) {
      errors.push(`Dòng ${line}: lịch ôn có số âm, phân số hoặc vượt giới hạn.`);
      return;
    }
    if (hskLevel !== undefined && (!Number.isInteger(hskLevel) || hskLevel < 1 || hskLevel > 9)) {
      errors.push(`Dòng ${line}: cấp HSK không hợp lệ.`);
      return;
    }
    if (trackValue && !hskTrack) {
      errors.push(`Dòng ${line}: bộ HSK không hợp lệ.`);
      return;
    }
    rows.push({
      simplified,
      traditional: at(row, 'traditional') || undefined,
      pinyinNum,
      hanViet: at(row, 'hanviet'),
      meaningVi: splitList(at(row, 'meaningvi')),
      meaningEn: splitList(at(row, 'meaningen')),
      pos: splitList(at(row, 'partofspeech')),
      classifiers: splitList(at(row, 'classifiers')),
      hskLevel,
      hskTrack,
      tags: splitList(at(row, 'tags')),
      createdAt: timeOrUndefined(at(row, 'createdat')),
      schedule:
        repetition !== undefined && intervalDays !== undefined
          ? {
              repetition,
              easeFactor: easeFactor ?? 2.5,
              intervalDays,
              lapses: lapses ?? 0,
              due: due ?? Date.now(),
            }
          : undefined,
    });
  });

  return { rows, errors };
}
