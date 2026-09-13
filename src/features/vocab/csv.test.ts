import { describe, expect, it } from 'vitest';
import type { Card, Word } from '@/domain/types';
import { CSV_BOM, parseCsv, parseVocabCsv, toCsv, VOCAB_CSV_COLUMNS, wordToCsvRow } from './csv';

const word: Word = {
  id: 'w1',
  simplified: '银行',
  traditional: '銀行',
  pinyinNum: 'yin2 hang2',
  pinyinVariants: [],
  hanViet: 'NGÂN HÀNG',
  meaningVi: ['ngân hàng', 'nhà băng'],
  meaningEn: ['bank'],
  pos: ['n'],
  classifiers: ['家'],
  hsk: { hsk3: 2 },
  cognate: true,
  source: 'hsk-list',
  examples: [],
  imageStatus: 'none',
  tags: ['tiền', 'du lịch'],
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  updatedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
};

const card: Card = {
  id: 'read:w1',
  subjectType: 'word',
  subjectId: 'w1',
  facet: 'read',
  state: 'review',
  repetition: 3,
  easeFactor: 2.5,
  intervalDays: 8,
  due: Date.UTC(2026, 0, 10),
  lapses: 1,
};

describe('CSV text', () => {
  it('quotes commas, quotes and newlines, and writes a BOM with CRLF', () => {
    const text = toCsv([
      ['a', 'b,c'],
      ['say "hi"', 'line\nbreak'],
    ]);
    expect(text.startsWith(CSV_BOM)).toBe(true);
    expect(text).toContain('a,"b,c"\r\n');
    expect(text).toContain('"say ""hi""","line\nbreak"');
  });

  it('round-trips Vietnamese and Chinese text', () => {
    const rows = [
      ['Hanzi', 'MeaningVi'],
      ['银行', 'ngân hàng; nhà băng'],
      ['你好', 'xin chào, chào bạn'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('accepts LF-only files and ignores a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('vocabulary rows', () => {
  it('exports every column in order', () => {
    const row = wordToCsvRow(word, card, 'hsk3');
    expect(row).toHaveLength(VOCAB_CSV_COLUMNS.length);
    expect(row.slice(0, 11)).toEqual([
      '银行',
      '銀行',
      'yin2 hang2',
      'NGÂN HÀNG',
      'ngân hàng; nhà băng',
      'bank',
      'n',
      '家',
      '2',
      'hsk3',
      'tiền; du lịch',
    ]);
    expect(row[11]).toBe('Nhớ');
  });

  it('re-imports its own export, keeping the schedule', () => {
    const csv = toCsv([[...VOCAB_CSV_COLUMNS], wordToCsvRow(word, card, 'hsk3')]);
    const { rows, errors } = parseVocabCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      simplified: '银行',
      traditional: '銀行',
      pinyinNum: 'yin2 hang2',
      hanViet: 'NGÂN HÀNG',
      meaningVi: ['ngân hàng', 'nhà băng'],
      tags: ['tiền', 'du lịch'],
      hskLevel: 2,
      hskTrack: 'hsk3',
    });
    expect(rows[0]?.schedule).toEqual({ repetition: 3, easeFactor: 2.5, intervalDays: 8, lapses: 1, due: card.due });
  });

  it('neutralizes spreadsheet formulas and restores app-authored values on import', () => {
    const dangerous = ['=1+1', ' +SUM(A1:A2)', '-2+3', '@cmd'];
    const csv = toCsv([dangerous], { bom: false });
    expect(csv).not.toMatch(/(^|,)[\s]*[=+\-@]/);
    expect(parseCsv(csv)[0]).toEqual(dangerous.map((value) => `'${value}`));
  });

  it('imports a minimal list of characters only', () => {
    const { rows, errors } = parseVocabCsv('Hanzi\n猫\n狗\n');
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.simplified)).toEqual(['猫', '狗']);
    expect(rows[0]?.schedule).toBeUndefined();
  });

  it('reports missing characters, duplicates and a missing header', () => {
    const { rows, errors } = parseVocabCsv('Hanzi,Pinyin\n猫,mao1\n,mao1\n猫,mao1\n');
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(['Dòng 3: thiếu chữ Hán.', 'Dòng 4: trùng với dòng trước (猫).']);
    expect(parseVocabCsv('Từ,Nghĩa\n猫,mèo').errors[0]).toContain('Hanzi');
  });
});
