import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { db } from '@/db/db';
import { Button } from '@/ui/Button';
import { parseVocabCsv, type VocabCsvRow } from './csv';
import { applyVocabImport, planVocabImport, type ImportMode, type ImportPlan } from './vocabImport';

interface Preview {
  plan: ImportPlan;
  errors: string[];
  fileName: string;
}

/** Reads a CSV, shows what would change, then applies it. */
export function VocabImportDialog({ onClose }: { onClose: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);

  const readFile = async (file: File) => {
    setBusy(true);
    try {
      const { rows, errors } = parseVocabCsv(await file.text());
      const existing = await db.words.toArray();
      setPreview({ plan: planVocabImport(rows, existing), errors, fileName: file.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đọc được tệp.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const summary = await applyVocabImport(preview.plan, mode);
      toast.success(`Đã thêm ${summary.created} từ, cập nhật ${summary.updated} từ.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nhập thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const sample = (rows: readonly VocabCsvRow[]) => rows.slice(0, 5).map((row) => row.simplified).join('、');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Nhập CSV">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">Nhập từ vựng từ CSV</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-muted hover:text-fg">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />

        {!preview ? (
          <div className="space-y-3">
            <p className="text-sm text-sub">
              Cần ít nhất cột <code className="rounded bg-surface-2 px-1">Hanzi</code>. Tệp do HanziStep xuất ra sẽ giữ lịch thẻ đọc; ảnh và thẻ nghe/nói nằm trong bản sao lưu JSON.
            </p>
            <Button onClick={() => fileInput.current?.click()} disabled={busy}>
              Chọn tệp CSV…
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-sub">{preview.fileName}</p>
            <ul className="space-y-1 text-sm text-fg">
              <li>
                Thêm mới: <strong>{preview.plan.create.length}</strong> từ{' '}
                {preview.plan.create.length > 0 && <span className="font-hanzi text-sub">({sample(preview.plan.create)}…)</span>}
              </li>
              <li>
                Đã có sẵn: <strong>{preview.plan.update.length}</strong> từ
              </li>
            </ul>
            {preview.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-xl bg-danger/10 p-3 text-sm text-danger">
                {preview.errors.slice(0, 10).map((error) => (
                  <p key={error}>{error}</p>
                ))}
                {preview.errors.length > 10 && <p>… và {preview.errors.length - 10} dòng khác.</p>}
              </div>
            )}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Với từ đã có sẵn</legend>
              {(
                [
                  ['merge', 'Gộp: giữ nghĩa cũ, thêm nghĩa và tag mới'],
                  ['overwrite', 'Ghi đè: thay nghĩa và tag bằng dữ liệu trong tệp'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-sub">
                  <input type="radio" name="import-mode" checked={mode === value} onChange={() => setMode(value)} className="accent-primary" />
                  {label}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-muted">Lịch ôn của từ đã có sẵn không bị thay đổi.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void apply()} disabled={busy}>
                Nhập {preview.plan.create.length + preview.plan.update.length} từ
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                Chọn tệp khác
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
