import { useLiveQuery } from 'dexie-react-hooks';
import { Headphones, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { levelLabel, MAX_LEVEL } from '@/data/hsk';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import { deleteText, listTexts } from '@/features/reading/repository';
import { DIALOGUE_SCENES } from '@/services/ai/prompts/dialogue';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import { generateDialogue } from './dialogue';

/** Below this many learned words the dialogues stay tiny (docs/PLAN.md §7.1). */
const MICRO_LIMIT = 30;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function NewDialogueDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const navigate = useNavigate();
  const [level, setLevel] = useState(settings.currentLevel);
  const [scene, setScene] = useState<string>(DIALOGUE_SCENES[0]);
  const [busy, setBusy] = useState(false);
  const learned = useLiveQuery(() => db.cards.where('facet').equals('read').count(), []);
  const micro = (learned ?? 0) < MICRO_LIMIT;

  const create = async () => {
    setBusy(true);
    try {
      const result = await generateDialogue({ level, scene, micro });
      toast.success(`Đã tạo hội thoại · bạn hiểu được ${Math.round(result.coverage * 100)}%${result.retried ? ' (đã viết lại 1 lần)' : ''}`);
      onClose();
      void navigate(`/listening/${result.doc.id}`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Tạo hội thoại">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-fg">Tạo hội thoại để luyện nghe</h2>
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
              Tình huống
              <SelectInput value={scene} onChange={(event) => setScene(event.target.value)} className="mt-1">
                {DIALOGUE_SCENES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectInput>
            </label>
            <p className="text-sm text-sub">
              {micro
                ? 'Bạn mới học ít từ, nên hội thoại chỉ 2–4 lượt, câu rất ngắn.'
                : `Chỉ dùng từ bạn đã học và từ HSK tới ${levelLabel(level)}.`}
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void create()} disabled={busy || !settings.geminiApiKey}>
            {busy ? 'Đang viết…' : 'Tạo hội thoại'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ListeningPage() {
  const texts = useLiveQuery(() => listTexts(), []);
  const [creating, setCreating] = useState(false);
  const dialogues = (texts ?? []).filter((doc) => doc.kind === 'ai-dialogue');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Nghe & Nói"
        subtitle="Nghe trước khi nhìn chữ: nghe hội thoại, trả lời câu hỏi, rồi mới xem lời thoại."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreating(true)}>
              <Sparkles className="size-4" aria-hidden /> Tạo hội thoại
            </Button>
            <Link
              to="/listening/shadow"
              className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-fg transition hover:bg-surface-2"
            >
              Luyện nhại
            </Link>
            <Link
              to="/coach"
              className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-fg transition hover:bg-surface-2"
            >
              AI Coach
            </Link>
          </div>
        }
      />

      {texts === undefined && <p className="text-sub">Đang tải…</p>}
      {texts !== undefined && dialogues.length === 0 && (
        <Card>
          <div className="py-8 text-center">
            <Headphones className="mx-auto size-10 text-muted" aria-hidden />
            <p className="mt-3 text-fg">Chưa có hội thoại nào.</p>
            <p className="mt-1 text-sm text-sub">Tạo một đoạn hội thoại ngắn chỉ dùng những từ bạn đã học.</p>
            <Button className="mt-4" onClick={() => setCreating(true)}>
              Tạo hội thoại
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {dialogues.map((doc) => (
          <Card key={doc.id} className="flex flex-wrap items-center gap-4">
            <Link to={`/listening/${doc.id}`} className="min-w-0 flex-1">
              <p className="font-hanzi text-lg text-fg">{doc.title}</p>
              {doc.titleVi && (
                <p className="text-sm text-sub" lang="vi">
                  {doc.titleVi}
                </p>
              )}
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                {doc.level && <span>{levelLabel(doc.level)}</span>}
                <span>{doc.sentences.length} lượt</span>
                {doc.coverage !== undefined && <span>Hiểu được {Math.round(doc.coverage * 100)}%</span>}
                <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                {doc.progress.completedAt && <span className="text-success">Đã nghe xong</span>}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Xoá ${doc.title}`}
              onClick={() => {
                if (!window.confirm(`Xoá hội thoại “${doc.title}”?`)) return;
                void deleteText(doc.id).then(
                  () => toast('Đã xoá hội thoại.'),
                  (error: unknown) => toast.error(errorText(error)),
                );
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </Card>
        ))}
      </div>

      {creating && <NewDialogueDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
