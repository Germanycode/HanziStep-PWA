import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { loadHanvietData } from '@/data/hanvietData';
import { useDictionaryStatus } from '@/data/dictImport';
import { searchDictionary } from '@/data/dictionary';
import type { DictEntry } from '@/domain/types';
import { announceActivity } from '@/progress/announce';
import { useWordSpeaker } from '@/services/speech/wordSpeaker';
import { AudioButton } from '@/ui/AudioButton';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/form';
import { PinyinText } from '@/ui/PinyinText';
import { saveWordForLater } from './repository';
import { wordFromDictEntry } from './wordFactory';

const SEARCH_DELAY_MS = 200;

/** Ctrl+K dictionary lookup: search 125k entries and save a word to learn later. */
export function QuickLookup() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictEntry[]>([]);
  const [saving, setSaving] = useState('');
  const status = useDictionaryStatus();
  const { sayWord } = useWordSpeaker();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }
      searchDictionary(trimmed, 20).then(setResults, () => setResults([]));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  const save = async (entry: DictEntry) => {
    setSaving(entry.s + entry.p);
    try {
      const hanviet = await loadHanvietData().catch(() => null);
      const word = wordFromDictEntry(entry, hanviet, Date.now());
      const { created, activity } = await saveWordForLater(word);
      if (activity) announceActivity(activity, `Lưu từ ${word.simplified}`);
      else toast(created ? 'Đã lưu từ.' : 'Từ này đã có trong danh sách của bạn.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được từ.');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24" role="dialog" aria-modal="true" aria-label="Tra từ nhanh">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="size-5 text-muted" aria-hidden />
          <TextInput
            aria-label="Tra từ"
            placeholder="Chữ Hán hoặc pinyin: 银行, yinhang…"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-0 bg-transparent"
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="text-muted hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {status.status === 'importing' && (
            <p className="p-4 text-sm text-sub">
              Đang nạp từ điển… {status.total > 0 ? `${Math.round((status.done / status.total) * 100)}%` : ''}
            </p>
          )}
          {status.status === 'unavailable' && <p className="p-4 text-sm text-danger">Chưa có gói dữ liệu từ điển.</p>}
          {results.length === 0 && query.trim() !== '' && status.status === 'ready' && (
            <p className="p-4 text-sm text-muted">Không tìm thấy từ nào.</p>
          )}
          <ul className="divide-y divide-line">
            {results.map((entry) => (
              <li key={`${entry.s}-${entry.p}-${entry.id ?? ''}`} className="flex items-start gap-3 p-3">
                <AudioButton label={`Nghe ${entry.s}`} onPlay={() => sayWord({ simplified: entry.s, pinyinNum: entry.p })} className="mt-1 text-sub" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-hanzi text-xl text-fg">{entry.s}</span>
                    {entry.t !== entry.s && <span className="font-hanzi text-sm text-muted">{entry.t}</span>}
                    <PinyinText pinyin={entry.p} className="text-sm" />
                  </p>
                  <p className="text-sm text-fg" lang="vi">
                    {entry.vi.slice(0, 3).join('; ') || entry.en.slice(0, 3).join('; ')}
                  </p>
                  {entry.vi.length > 0 && entry.en.length > 0 && <p className="text-xs text-muted">{entry.en.slice(0, 2).join('; ')}</p>}
                </div>
                <Button size="sm" variant="outline" disabled={saving === entry.s + entry.p} onClick={() => void save(entry)}>
                  Lưu từ
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">Ctrl+K để mở lại · Esc để đóng</p>
      </div>
    </div>
  );
}
