import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, ClipboardPaste, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { levelLabel, MAX_LEVEL } from '@/data/hsk';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import { pendingWordsToLearn } from '@/features/vocab/repository';
import { STORY_GENRES } from '@/services/ai/prompts/story';
import { SOURCE_LABELS } from '@/services/images/providers';
import { useStoredImage } from '@/services/images/store';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectInput, TextInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import { sentencesFromText } from './pipeline';
import { createText, deleteText, listTexts } from './repository';
import { generateStory } from './story';

const KIND_LABELS: Record<string, string> = { 'ai-story': 'Truyện AI', 'ai-dialogue': 'Hội thoại AI', pasted: 'Văn bản dán' };
/** Below this many learned words the reader gets micro-texts (docs/PLAN.md §7.1). */
const MICRO_TEXT_LIMIT = 30;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The stored illustration of a text, if it has one. */
function TextThumbnail({ id, hasImage }: { id: string; hasImage: boolean }) {
  const image = useStoredImage(id, hasImage);
  if (!image) return null;
  return (
    <img
      src={image.url}
      alt=""
      title={`${image.author} · ${SOURCE_LABELS[image.source]}`}
      className="size-16 shrink-0 rounded-xl object-cover"
    />
  );
}

function PasteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const sentences = sentencesFromText(body);
    if (sentences.length === 0) {
      toast.error('Chưa có nội dung tiếng Trung.');
      return;
    }
    setBusy(true);
    try {
      const doc = await createText({
        kind: 'pasted',
        title: title.trim() || (sentences[0]?.zh.slice(0, 20) ?? 'Bài đọc'),
        sentences,
      });
      onClose();
      void navigate(`/reading/${doc.id}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Dán văn bản">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-fg">Dán văn bản tiếng Trung</h2>
        <TextInput aria-label="Tiêu đề" placeholder="Tiêu đề (không bắt buộc)" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea
          aria-label="Nội dung"
          lang="zh-CN"
          rows={10}
          autoFocus
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Dán bài đọc vào đây…"
          className="font-hanzi mt-3 w-full rounded-xl border border-line bg-surface-2 p-3 text-lg text-fg outline-none focus:border-primary"
        />
        <input
          ref={fileInput}
          type="file"
          accept="text/plain,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              setBody(text);
              if (!title.trim()) setTitle(file.name.replace(/\.txt$/i, ''));
            });
          }}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void create()} disabled={busy || !body.trim()}>
            Tạo bài đọc
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload className="size-4" aria-hidden /> Mở tệp .txt
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
        </div>
      </div>
    </div>
  );
}

function StoryDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const navigate = useNavigate();
  const [level, setLevel] = useState(settings.currentLevel);
  const [genre, setGenre] = useState<string>(STORY_GENRES[0]);
  const [busy, setBusy] = useState(false);

  const info = useLiveQuery(async () => {
    const [pending, learned] = await Promise.all([pendingWordsToLearn(), db.cards.where('facet').equals('read').count()]);
    return { pending, learned };
  }, []);
  const micro = (info?.learned ?? 0) < MICRO_TEXT_LIMIT;

  const create = async () => {
    setBusy(true);
    try {
      const result = await generateStory({ level, genre, targets: info?.pending ?? [], micro });
      const percent = Math.round(result.coverage * 100);
      toast.success(`Đã tạo bài đọc · bạn đọc được ${percent}%${result.retried ? ' (đã viết lại 1 lần)' : ''}`);
      onClose();
      void navigate(`/reading/${result.doc.id}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Tạo truyện">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-fg">Tạo bài đọc bằng AI</h2>
        {!settings.geminiApiKey ? (
          <p className="text-sm text-sub">
            Cần Gemini API key.{' '}
            <Link to="/settings" className="text-primary hover:underline">
              Nhập trong Cài đặt
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm text-sub">
              Cấp độ
              <SelectInput value={level} onChange={(event) => setLevel(Number(event.target.value))} className="mt-1">
                {Array.from({ length: MAX_LEVEL[settings.hskTrack] }, (_, index) => index + 1).map((item) => (
                  <option key={item} value={item}>
                    {levelLabel(item)}
                  </option>
                ))}
              </SelectInput>
            </label>
            <label className="block text-sm text-sub">
              Chủ đề
              <SelectInput value={genre} onChange={(event) => setGenre(event.target.value)} className="mt-1">
                {STORY_GENRES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </label>
            <p className="text-sm text-sub">
              {micro
                ? 'Bạn mới học ít từ, nên bài sẽ rất ngắn (2–4 câu) và có đủ pinyin cùng nghĩa tiếng Việt.'
                : `Bài chỉ dùng những từ bạn đã học và từ HSK tới ${levelLabel(level)}.`}
              {info && info.pending.length > 0 && ` Sẽ lồng ${Math.min(info.pending.length, 6)} từ bạn đã lưu.`}
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void create()} disabled={busy || !settings.geminiApiKey}>
            {busy ? 'Đang viết…' : 'Tạo bài đọc'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReadingLibraryPage() {
  const texts = useLiveQuery(() => listTexts(), []);
  const [pasting, setPasting] = useState(false);
  const [generating, setGenerating] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Đọc"
        subtitle="Chạm vào bất kỳ từ nào để tra nghĩa, nghe và lưu vào danh sách học."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setGenerating(true)}>
              <Sparkles className="size-4" aria-hidden /> Tạo truyện AI
            </Button>
            <Button variant="outline" onClick={() => setPasting(true)}>
              <ClipboardPaste className="size-4" aria-hidden /> Dán văn bản
            </Button>
          </div>
        }
      />

      {texts === undefined && <p className="text-sub">Đang tải…</p>}
      {texts?.length === 0 && (
        <Card>
          <div className="py-8 text-center">
            <BookOpen className="mx-auto size-10 text-muted" aria-hidden />
            <p className="mt-3 text-fg">Chưa có bài đọc nào.</p>
            <p className="mt-1 text-sm text-sub">Dán một đoạn tiếng Trung để bắt đầu — mỗi từ đều tra được ngay trong bài.</p>
            <Button className="mt-4" onClick={() => setPasting(true)}>
              Dán văn bản
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {(texts ?? []).map((doc) => (
          <Card key={doc.id} className="flex flex-wrap items-center gap-4">
            <TextThumbnail id={doc.id} hasImage={Boolean(doc.imageUrl)} />
            <Link to={`/reading/${doc.id}`} className="min-w-0 flex-1">
              <p className="font-hanzi text-lg text-fg">{doc.title}</p>
              {doc.titleVi && (
                <p className="text-sm text-sub" lang="vi">
                  {doc.titleVi}
                </p>
              )}
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                <span>{KIND_LABELS[doc.kind] ?? doc.kind}</span>
                {doc.level && <span>{levelLabel(doc.level)}</span>}
                <span>{doc.sentences.length} câu</span>
                {doc.coverage !== undefined && <span>Đã thuộc {Math.round(doc.coverage * 100)}%</span>}
                <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                {doc.progress.completedAt && <span className="text-success">Đã đọc xong</span>}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Xoá ${doc.title}`}
              onClick={() => {
                if (!window.confirm(`Xoá bài “${doc.title}”?`)) return;
                void deleteText(doc.id).then(
                  () => toast('Đã xoá bài đọc.'),
                  (error: unknown) => toast.error(errorText(error)),
                );
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Card>
        ))}
      </div>

      {pasting && <PasteDialog onClose={() => setPasting(false)} />}
      {generating && <StoryDialog onClose={() => setGenerating(false)} />}
    </div>
  );
}
