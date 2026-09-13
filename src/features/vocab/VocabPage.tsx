import { Download, Search, Upload } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { levelLabel } from '@/data/hsk';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import { masteryLabel } from '@/srs/cards';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectInput, TextInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import { PinyinText } from '@/ui/PinyinText';
import { toCsv, VOCAB_CSV_COLUMNS, wordToCsvRow } from './csv';
import {
  buildVocabRows,
  countVocab,
  DEFAULT_VOCAB_FILTERS,
  filterVocabRows,
  vocabTags,
  type MasteryFilter,
  type VocabSort,
} from './list';
import { deleteWords } from './repository';
import { VocabImportDialog } from './VocabImportDialog';
import { WordDetail } from './WordDetail';

const PAGE_SIZE = 25;

const MASTERY_OPTIONS: { value: MasteryFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả mức' },
  { value: 'pending', label: 'Chờ học' },
  { value: 'learning', label: 'Đang học' },
  { value: 'review', label: 'Đang ôn' },
  { value: 'mastered', label: 'Thành thạo' },
  { value: 'known', label: 'Đã biết' },
];

const SORT_OPTIONS: { value: VocabSort; label: string }[] = [
  { value: 'recent', label: 'Mới thêm' },
  { value: 'alpha', label: 'Theo pinyin' },
  { value: 'due', label: 'Sắp đến hạn' },
  { value: 'mastery', label: 'Mức thuộc' },
  { value: 'hsk', label: 'Cấp HSK' },
];

function downloadCsv(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function VocabPage() {
  const settings = useSettings();
  const [filters, setFilters] = useState(DEFAULT_VOCAB_FILTERS);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const data = useLiveQuery(async () => {
    const [words, cards] = await Promise.all([db.words.toArray(), db.cards.toArray()]);
    return { words, cards };
  }, []);

  const rows = useMemo(() => (data ? buildVocabRows(data.words, data.cards, settings.hskTrack) : []), [data, settings.hskTrack]);
  const filtered = useMemo(() => filterVocabRows(rows, filters), [rows, filters]);
  const counts = useMemo(() => countVocab(rows), [rows]);
  const tags = useMemo(() => vocabTags(data?.words ?? []), [data]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const detail = detailId ? rows.find((row) => row.word.id === detailId) : undefined;

  const update = (patch: Partial<typeof filters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(0);
  };

  const exportCsv = () => {
    const table = [[...VOCAB_CSV_COLUMNS], ...filtered.map((row) => wordToCsvRow(row.word, row.read, settings.hskTrack))];
    downloadCsv(`hanzistep-vocab-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(table));
    toast.success(`Đã xuất ${filtered.length} từ.`);
  };

  const removeSelected = () => {
    if (selected.length === 0 || !window.confirm(`Xoá ${selected.length} từ đã chọn?`)) return;
    void deleteWords(selected).then(
      () => {
        toast(`Đã xoá ${selected.length} từ.`);
        setSelected([]);
      },
      (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không xoá được.'),
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Từ vựng"
        subtitle={`${counts.total} từ · ${counts.pending} chờ học · ${counts.learning + counts.review} đang ôn · ${counts.mastered} thành thạo · ${counts.known} đã biết`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="size-4" aria-hidden /> Xuất CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
              <Upload className="size-4" aria-hidden /> Nhập CSV
            </Button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
            <Search className="size-4 text-muted" aria-hidden />
            <TextInput
              aria-label="Tìm từ"
              placeholder="Chữ Hán, pinyin, nghĩa hoặc tag…"
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
              className="border-0 bg-transparent px-0"
            />
          </div>
          <SelectInput
            aria-label="Lọc theo mức thuộc"
            value={filters.mastery}
            onChange={(event) => update({ mastery: event.target.value as MasteryFilter })}
            className="max-w-40"
          >
            {MASTERY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <SelectInput aria-label="Lọc theo cấp" value={filters.level} onChange={(event) => update({ level: event.target.value })} className="max-w-36">
            <option value="">Mọi cấp</option>
            {[1, 2, 3, 4, 5, 6, 7].map((level) => (
              <option key={level} value={String(level)}>
                {levelLabel(level)}
              </option>
            ))}
            <option value="none">Ngoài HSK</option>
          </SelectInput>
          {tags.length > 0 && (
            <SelectInput aria-label="Lọc theo tag" value={filters.tag} onChange={(event) => update({ tag: event.target.value })} className="max-w-36">
              <option value="">Mọi tag</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </SelectInput>
          )}
          <SelectInput
            aria-label="Sắp xếp"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value as VocabSort })}
            className="max-w-36"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          {selected.length > 0 && (
            <Button variant="danger" size="sm" onClick={removeSelected}>
              Xoá {selected.length} từ
            </Button>
          )}
        </div>

        {data === undefined ? (
          <p className="mt-6 text-sub">Đang tải…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-sub">
            {counts.total === 0 ? (
              <>
                Chưa có từ nào.{' '}
                <Link to="/learn" className="text-primary hover:underline">
                  Học từ mới
                </Link>{' '}
                hoặc nhấn Ctrl+K để tra từ điển.
              </>
            ) : (
              'Không có từ nào khớp bộ lọc.'
            )}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-left text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả trong trang"
                      className="accent-primary"
                      checked={pageRows.length > 0 && pageRows.every((row) => selected.includes(row.word.id))}
                      onChange={(event) =>
                        setSelected((previous) => {
                          const ids = pageRows.map((row) => row.word.id);
                          return event.target.checked ? [...new Set([...previous, ...ids])] : previous.filter((id) => !ids.includes(id));
                        })
                      }
                    />
                  </th>
                  <th className="px-2 py-2">Từ</th>
                  <th className="px-2 py-2">Hán Việt</th>
                  <th className="px-2 py-2">Nghĩa</th>
                  <th className="px-2 py-2">Cấp</th>
                  <th className="px-2 py-2">Tag</th>
                  <th className="px-2 py-2">Mức</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.word.id}
                    className="cursor-pointer border-b border-line/60 transition hover:bg-surface-2"
                    onClick={() => setDetailId(row.word.id)}
                  >
                    <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${row.word.simplified}`}
                        className="accent-primary"
                        checked={selected.includes(row.word.id)}
                        onChange={(event) =>
                          setSelected((previous) =>
                            event.target.checked ? [...previous, row.word.id] : previous.filter((id) => id !== row.word.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-hanzi text-lg text-fg">{row.word.simplified}</span>
                      <PinyinText pinyin={row.word.pinyinNum} className="ml-2 text-xs" />
                    </td>
                    <td className="px-2 py-2 text-xs font-semibold text-accent">{row.word.hanViet}</td>
                    <td className="max-w-xs truncate px-2 py-2 text-fg" lang="vi">
                      {row.word.meaningVi[0] ?? row.word.meaningEn[0] ?? ''}
                    </td>
                    <td className="px-2 py-2 text-sub">{row.level ? levelLabel(row.level) : '—'}</td>
                    <td className="px-2 py-2 text-sub">{row.word.tags.map((tag) => `#${tag}`).join(' ')}</td>
                    <td className="px-2 py-2 text-sub">
                      {row.word.knownWithoutSrs ? 'Đã biết' : row.mastery < 0 ? 'Chờ học' : masteryLabel(row.mastery)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-sub">
            <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>
              Trang trước
            </Button>
            <span>
              Trang {current + 1}/{pageCount} · {filtered.length} từ
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current + 1 >= pageCount}>
              Trang sau
            </Button>
          </div>
        )}
      </Card>

      {detail && <WordDetail word={detail.word} read={detail.read} listen={detail.listen} onClose={() => setDetailId(null)} />}
      {importing && <VocabImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}
