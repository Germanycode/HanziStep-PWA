import { ImagePlus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Card, Word } from '@/domain/types';
import { announceActivity } from '@/progress/announce';
import { intervalLabel, masteryLabel } from '@/srs/cards';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/form';
import { ImagePicker } from './ImagePicker';
import { deleteWords, introduceWord, markWordKnown, setWordTags, updateWord } from './repository';
import { removeWordImage } from './images';
import { WordImage } from './WordImage';
import { WordIntroCard } from './WordIntroCard';

interface WordDetailProps {
  word: Word;
  read?: Card;
  listen?: Card;
  onClose: () => void;
}

function CardLine({ label, card }: { label: string; card?: Card }) {
  if (!card) return null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 text-sm text-sub">
      <span className="font-medium text-fg">{label}</span>
      <span>{card.state === 'suspended' ? 'Đang khoá' : masteryLabel(card.repetition)}</span>
      <span>· cách {intervalLabel(card.intervalDays)}</span>
      <span>· đến hạn {new Date(card.due).toLocaleString('vi-VN')}</span>
      <span>· EF {card.easeFactor.toFixed(2)}</span>
      {card.lapses > 0 && <span>· quên {card.lapses} lần</span>}
    </li>
  );
}

/** Side panel for one word: full card, tags, picture and actions. */
export function WordDetail({ word, read, listen, onClose }: WordDetailProps) {
  const [tags, setTags] = useState(word.tags.join(', '));
  const [pickingImage, setPickingImage] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const saveTags = () =>
    run(async () => {
      const activity = await setWordTags(
        word.id,
        tags.split(',').map((tag) => tag.trim()),
      );
      if (activity) announceActivity(activity, 'Gắn tag');
      else toast.success('Đã lưu tag.');
    });

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-line bg-surface p-5 shadow-2xl"
      aria-label={`Chi tiết từ ${word.simplified}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Chi tiết từ</h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="text-muted hover:text-fg">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <WordIntroCard word={word} />

      <ul className="mt-5 space-y-1 border-t border-line pt-4">
        <CardLine label="Đọc" card={read} />
        <CardLine label="Nghe" card={listen} />
        {!read && !listen && (
          <li className="text-sm text-sub">{word.knownWithoutSrs ? 'Đã đánh dấu là từ đã biết.' : 'Chưa vào lịch ôn — sẽ học ở mục Học mới.'}</li>
        )}
      </ul>

      <div className="mt-5 border-t border-line pt-4">
        <label className="text-sm font-medium text-fg" htmlFor={`tags-${word.id}`}>
          Tag (cách nhau bằng dấu phẩy)
        </label>
        <div className="mt-2 flex gap-2">
          <TextInput
            id={`tags-${word.id}`}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              event.stopPropagation();
              void saveTags();
            }}
          />
          <Button onClick={() => void saveTags()} disabled={busy}>
            Lưu
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <WordImage word={word} className="size-24" />
          <Button variant="outline" onClick={() => setPickingImage((value) => !value)}>
            <ImagePlus className="size-4" aria-hidden /> {word.imageStatus === 'ok' ? 'Đổi ảnh' : 'Thêm ảnh'}
          </Button>
          {word.imageStatus === 'ok' && (
            <Button variant="ghost" onClick={() => void run(() => removeWordImage(word.id))} disabled={busy}>
              Xoá ảnh
            </Button>
          )}
        </div>
        {pickingImage && (
          <div className="mt-3">
            <ImagePicker word={word} onDone={() => setPickingImage(false)} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
        {!read && !word.knownWithoutSrs && (
          <Button
            onClick={() =>
              void run(async () => {
                await introduceWord(word);
                toast.success('Đã đưa vào lịch ôn.');
              })
            }
            disabled={busy}
          >
            Đưa vào lịch ôn
          </Button>
        )}
        {word.knownWithoutSrs ? (
          <Button variant="outline" onClick={() => void run(() => updateWord(word.id, { knownWithoutSrs: false }))} disabled={busy}>
            Bỏ đánh dấu “đã biết”
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() =>
              void run(async () => {
                await markWordKnown(word);
                toast('Đã đánh dấu là từ đã biết.');
              })
            }
            disabled={busy}
          >
            Tôi đã biết từ này
          </Button>
        )}
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Xoá từ “${word.simplified}” và lịch ôn của nó?`)) return;
            void run(async () => {
              await deleteWords([word.id]);
              toast('Đã xoá từ.');
              onClose();
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Xoá từ
        </Button>
      </div>
    </aside>
  );
}
