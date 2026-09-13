import { ArrowLeft, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pinyinToMarks } from '@/chinese/pinyin';
import { useSettings } from '@/db/settings';
import { gradeDictation, gradeOrder, gradePinyin } from '@/features/review/engine/grading';
import { shuffle } from '@/lib/random';
import { announceActivity } from '@/progress/announce';
import { recordActivity } from '@/progress/recordActivity';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectInput, TextInput } from '@/ui/form';

export type DictationMode = 'pinyin' | 'tiles' | 'hanzi';

const MODE_LABELS: Record<DictationMode, string> = {
  pinyin: 'Gõ pinyin (dễ nhất)',
  tiles: 'Xếp thẻ từ',
  hanzi: 'Gõ chữ Hán (cần bộ gõ)',
};

/** XP for one sentence: 10 when perfect, 4 when nearly right (docs/PLAN.md §6.1). */
function xpFor(accuracy: number): number {
  if (accuracy >= 1) return 10;
  return accuracy >= 0.9 ? 4 : 0;
}

export interface DictationItem {
  index: number;
  zh: string;
  /** Numbered pinyin of the whole sentence, from the prepared transcript. */
  pinyinNum: string;
  tiles: string[];
}

interface DictationPanelProps {
  items: readonly DictationItem[];
  onPlay: (index: number) => void;
  onBack: () => void;
}

interface Result {
  correct: boolean;
  accuracy: number;
  detail?: string;
}

/** 听写: write down what you hear, in the mode that fits your level (docs/PLAN.md §8.3). */
export function DictationPanel({ items, onPlay, onBack }: DictationPanelProps) {
  const settings = useSettings();
  const [mode, setMode] = useState<DictationMode>('pinyin');
  const [position, setPosition] = useState(0);
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [bank, setBank] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const item = items[position];

  const startItem = (next: number) => {
    setPosition(next);
    setTyped('');
    setChosen([]);
    setResult(null);
    const tiles = items[next]?.tiles ?? [];
    setBank(shuffle(tiles));
  };

  const reward = (accuracy: number) => {
    const amount = xpFor(accuracy);
    if (amount === 0) return;
    setTotal((value) => value + amount);
    void recordActivity({ kind: 'dictation', amount, counters: { dictations: 1 } }).then(
      (activity) => announceActivity(activity, 'Chính tả'),
      (error: unknown) => toast.error(error instanceof Error ? error.message : 'Không lưu được điểm.'),
    );
  };

  const check = () => {
    if (!item || result) return;
    if (mode === 'pinyin') {
      if (!item.pinyinNum) {
        toast.error('Câu này chưa có pinyin để so sánh.');
        return;
      }
      const grade = gradePinyin(typed, [item.pinyinNum], settings.tonelessEasyMode);
      const accuracy = grade.correct ? 1 : 0;
      setResult({
        correct: grade.correct,
        accuracy,
        detail: grade.toneOnlyError ? 'Đúng âm tiết nhưng sai thanh.' : undefined,
      });
      reward(accuracy);
      return;
    }
    if (mode === 'tiles') {
      const texts = chosen.map((tileIndex) => item.tiles[tileIndex] ?? '');
      const correct = gradeOrder(texts, item.zh);
      setResult({ correct, accuracy: correct ? 1 : 0 });
      reward(correct ? 1 : 0);
      return;
    }
    const grade = gradeDictation(typed, item.zh);
    setResult({ correct: grade.correct, accuracy: grade.accuracy });
    reward(grade.accuracy);
  };

  if (!item) {
    return (
      <Card title="Chính tả">
        <p className="text-sub">Chưa có câu nào để luyện.</p>
        <Button className="mt-3" variant="outline" onClick={onBack}>
          Quay lại lời thoại
        </Button>
      </Card>
    );
  }

  const isLast = position + 1 >= items.length;

  return (
    <Card
      title="Chính tả"
      description="Nghe rồi viết lại. Bấm loa để nghe lại từng câu."
      actions={
        <SelectInput
          aria-label="Kiểu chính tả"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as DictationMode);
            startItem(position);
          }}
          className="max-w-56"
        >
          {(Object.keys(MODE_LABELS) as DictationMode[]).map((value) => (
            <option key={value} value={value}>
              {MODE_LABELS[value]}
            </option>
          ))}
        </SelectInput>
      }
    >
      <div className="flex items-center justify-between text-sm text-sub">
        <span>
          Câu {position + 1}/{items.length}
        </span>
        <span>{total > 0 ? `+${total} XP` : ''}</span>
      </div>

      <div className="my-4 flex justify-center">
        <Button onClick={() => onPlay(item.index)}>
          <Volume2 className="size-4" aria-hidden /> Nghe câu này
        </Button>
      </div>

      {mode === 'tiles' ? (
        <div className="space-y-3">
          <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-3">
            {chosen.length === 0 && <span className="text-sm text-muted">Chạm vào các thẻ bên dưới</span>}
            {chosen.map((tileIndex, order) => (
              <button
                key={`${tileIndex}-${order}`}
                type="button"
                disabled={Boolean(result)}
                onClick={() => setChosen((list) => list.filter((_, position_) => position_ !== order))}
                className="font-hanzi rounded-lg bg-primary/15 px-3 py-2 text-lg text-fg"
              >
                {item.tiles[tileIndex]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {bank.map((tile, tileIndex) => {
              const original = item.tiles.indexOf(tile);
              const used = chosen.filter((value) => item.tiles[value] === tile).length;
              const available = item.tiles.filter((value) => value === tile).length;
              if (used >= available) return null;
              return (
                <button
                  key={`${tile}-${tileIndex}`}
                  type="button"
                  disabled={Boolean(result)}
                  onClick={() => setChosen((list) => [...list, original])}
                  className="font-hanzi rounded-lg border border-line px-3 py-2 text-lg text-fg transition hover:bg-surface-2"
                >
                  {tile}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <TextInput
          aria-label={mode === 'pinyin' ? 'Pinyin của câu' : 'Chữ Hán của câu'}
          lang={mode === 'hanzi' ? 'zh-CN' : undefined}
          value={typed}
          disabled={Boolean(result)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={mode === 'pinyin' ? 'ni3 hao3 …' : '你好…'}
          className={mode === 'hanzi' ? 'font-hanzi text-lg' : ''}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || result) return;
            event.preventDefault();
            event.stopPropagation();
            check();
          }}
        />
      )}

      {result && (
        <div role="status" className={`mt-4 rounded-xl p-3 ${result.correct ? 'bg-success/10' : 'bg-danger/10'}`}>
          <p className={`font-semibold ${result.correct ? 'text-success' : 'text-danger'}`}>
            {result.correct ? 'Chính xác!' : `Chưa đúng · ${Math.round(result.accuracy * 100)}% ký tự khớp`}
          </p>
          {result.detail && <p className="text-sm text-sub">{result.detail}</p>}
          <p className="font-hanzi mt-2 text-lg text-fg">{item.zh}</p>
          {item.pinyinNum && <p className="text-sm text-sub">{pinyinToMarks(item.pinyinNum)}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!result ? (
          <Button onClick={check} disabled={mode === 'tiles' ? chosen.length !== item.tiles.length : !typed.trim()}>
            Kiểm tra
          </Button>
        ) : (
          <Button onClick={() => (isLast ? onBack() : startItem(position + 1))}>{isLast ? 'Xong' : 'Câu tiếp theo'}</Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Lời thoại
        </Button>
      </div>
    </Card>
  );
}
