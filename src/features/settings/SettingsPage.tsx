import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DEFAULT_SETTINGS, updateSettings, useLoadedSettings } from '@/db/settings';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/db/storage';
import { buildStorageReport, clearDictionary, trimImageCache, type StorageReport } from '@/db/storageReport';
import {
  autoBackupSupported,
  backupToFolder,
  getBackupFolder,
  getLastBackupAt,
  pickBackupFolder,
  shouldRemind,
} from '@/features/backup/autoBackup';
import {
  getLastPlacement,
  markLevelKnown,
  previewPlacement,
  undoLastPlacement,
  type LastPlacement,
  type PlacementPreview,
} from '@/features/vocab/placement';
import { resetDictionaryHeadwords } from '@/features/reading/pipeline';
import type { HskTrack, PinyinDisplay, Settings } from '@/domain/types';
import { BackupError, createBackup, downloadBackup, readBackupFile, restoreBackup } from '@/features/backup/backup';
import { vi } from '@/i18n/vi';
import { fsrsScheduler } from '@/srs/fsrs';
import { loadReviewHistories, MAX_REPLAY_CARDS } from '@/srs/history';
import { compareSchedulers, type SchedulerComparison } from '@/srs/replay';
import { SCHEDULER_LABELS } from '@/srs/schedulers';
import { sm2 } from '@/srs/sm2';
import { switchScheduler } from '@/srs/switchScheduler';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, NumberInput, SelectInput, Switch, TextInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import { VoiceCard } from './VoiceCard';

function save(patch: Partial<Settings>) {
  void updateSettings(patch).then(() => toast.success(vi.common.saved, { id: 'settings-saved', duration: 1200 }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const TRACK_OPTIONS: { value: HskTrack; label: string; maxLevel: number }[] = [
  { value: 'hsk3', label: 'HSK 3.0 (cấp 1–6, bậc 7–9)', maxLevel: 7 },
  { value: 'hsk3-newest', label: 'HSK 3.0 – bản cập nhật mới nhất', maxLevel: 7 },
  { value: 'hsk2', label: 'HSK 2.0 (6 cấp)', maxLevel: 6 },
];

const TONE_PREVIEW = [
  { text: 'mā', className: 'text-tone-1' },
  { text: 'má', className: 'text-tone-2' },
  { text: 'mǎ', className: 'text-tone-3' },
  { text: 'mà', className: 'text-tone-4' },
  { text: 'ma', className: 'text-tone-5' },
];

function TextSettingField({
  label,
  hint,
  value,
  secret = false,
  link,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: string;
  secret?: boolean;
  link?: { href: string; label: string };
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [visible, setVisible] = useState(!secret);
  const commit = () => {
    const next = draft.trim();
    if (next !== value) onCommit(next);
  };
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex gap-2">
        <TextInput
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={secret ? 'Chưa nhập' : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
        {secret && (
          <Button variant="outline" aria-label={visible ? vi.common.hide : vi.common.show} onClick={() => setVisible((v) => !v)}>
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </Button>
        )}
      </div>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {link.label} <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </Field>
  );
}

function ApiKeysCard({ settings }: { settings: Settings }) {
  return (
    <Card
      title="Khoá API"
      description="Không bắt buộc. Bạn tự tạo key rồi dán vào đây; khoá chỉ nằm trên máy này và không vào bản sao lưu (trừ khi bạn chọn)."
    >
      <div className="space-y-4">
        <TextSettingField
          key={`gemini-${settings.geminiApiKey}`}
          label="Gemini API key"
          hint="Dùng cho truyện AI, chấm câu, giải thích từ và AI Coach."
          value={settings.geminiApiKey}
          secret
          link={{ href: 'https://aistudio.google.com/apikey', label: 'Lấy key tại Google AI Studio' }}
          onCommit={(geminiApiKey) => save({ geminiApiKey })}
        />
        <TextSettingField
          key={`pixabay-${settings.pixabayApiKey}`}
          label="Pixabay API key"
          hint="Tìm ảnh minh hoạ cho từ vựng và bài đọc. Ảnh luôn được tải về máy."
          value={settings.pixabayApiKey}
          secret
          link={{ href: 'https://pixabay.com/api/docs/', label: 'Lấy key miễn phí tại Pixabay' }}
          onCommit={(pixabayApiKey) => save({ pixabayApiKey })}
        />
        <TextSettingField
          key={`unsplash-${settings.unsplashApiKey}`}
          label="Unsplash Access Key"
          hint="Nguồn ảnh thứ hai. Có key nào thì dùng key đó; có cả hai thì hiện ảnh của cả hai."
          value={settings.unsplashApiKey}
          secret
          link={{ href: 'https://unsplash.com/oauth/applications', label: 'Lấy key miễn phí tại Unsplash' }}
          onCommit={(unsplashApiKey) => save({ unsplashApiKey })}
        />
      </div>
    </Card>
  );
}

function ModelsCard({ settings }: { settings: Settings }) {
  const fields = [
    { key: 'geminiTextModel', label: 'Model văn bản', hint: 'Truyện, chấm câu, giải thích.' },
    { key: 'geminiLiveModel', label: 'Model Live (AI Coach)', hint: 'Model hội thoại giọng nói thời gian thực.' },
    { key: 'geminiTtsModel', label: 'Model đọc (TTS)', hint: 'Dự phòng khi máy không có giọng tiếng Trung.' },
  ] as const;
  const isDefault = fields.every(({ key }) => settings[key] === DEFAULT_SETTINGS[key]);
  return (
    <Card
      title="Mô hình AI"
      description="Tên model Gemini thay đổi theo thời gian; đổi ở đây mà không cần sửa code."
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={isDefault}
          onClick={() =>
            save({
              geminiTextModel: DEFAULT_SETTINGS.geminiTextModel,
              geminiLiveModel: DEFAULT_SETTINGS.geminiLiveModel,
              geminiTtsModel: DEFAULT_SETTINGS.geminiTtsModel,
            })
          }
        >
          {vi.common.reset}
        </Button>
      }
    >
      <div className="space-y-4">
        {fields.map(({ key, label, hint }) => (
          <TextSettingField
            key={`${key}-${settings[key]}`}
            label={label}
            hint={hint}
            value={settings[key]}
            onCommit={(value) => value && save({ [key]: value })}
          />
        ))}
      </div>
    </Card>
  );
}

function PlacementControl({ settings }: { settings: Settings }) {
  const maxLevel = TRACK_OPTIONS.find((option) => option.value === settings.hskTrack)?.maxLevel ?? 6;
  const [level, setLevel] = useState(1);
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  const [last, setLast] = useState<LastPlacement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      getLastPlacement().then(setLast, () => setLast(null));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const run = (action: () => Promise<string>) => {
    setBusy(true);
    action()
      .then((message) => {
        toast.success(message);
        setBusy(false);
        getLastPlacement().then(setLast, () => setLast(null));
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
        setBusy(false);
      });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectInput
        aria-label="Cấp muốn đánh dấu đã biết"
        value={level}
        onChange={(event) => {
          setLevel(Number(event.target.value));
          setPreview(null);
        }}
        className="max-w-32"
      >
        {Array.from({ length: maxLevel }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>
            {item === 7 ? 'Bậc 7–9' : `Cấp ${item}`}
          </option>
        ))}
      </SelectInput>

      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          previewPlacement(settings.hskTrack, level).then(
            (result) => {
              setPreview(result);
              setBusy(false);
            },
            (error: unknown) => {
              toast.error(errorMessage(error));
              setBusy(false);
            },
          );
        }}
      >
        Xem trước
      </Button>

      {preview && (
        <span className="text-sm text-sub">
          {preview.newWords} từ sẽ đánh dấu đã biết
          {preview.alreadyHave > 0 && `, ${preview.alreadyHave} từ đã có sẵn`}
        </span>
      )}

      {preview && preview.newWords > 0 && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await markLevelKnown(settings.hskTrack, level);
              setPreview(null);
              return `Đã đánh dấu ${result.added} từ là đã biết.`;
            })
          }
        >
          Đánh dấu đã biết
        </Button>
      )}

      {last && last.ids.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const removed = await undoLastPlacement();
              return `Đã hoàn tác ${removed} từ.`;
            })
          }
        >
          Hoàn tác lần trước ({last.ids.length})
        </Button>
      )}
    </div>
  );
}

function LearningCard({ settings }: { settings: Settings }) {
  const trackId = useId();
  const levelId = useId();
  const maxLevel = TRACK_OPTIONS.find((option) => option.value === settings.hskTrack)?.maxLevel ?? 6;
  return (
    <Card title="Học tập">
      <div className="space-y-4">
        <Field label="Bộ từ HSK" htmlFor={trackId}>
          <SelectInput
            id={trackId}
            value={settings.hskTrack}
            onChange={(event) => {
              const hskTrack = event.target.value as HskTrack;
              const limit = TRACK_OPTIONS.find((option) => option.value === hskTrack)?.maxLevel ?? 6;
              save({ hskTrack, currentLevel: Math.min(settings.currentLevel, limit) });
            }}
          >
            {TRACK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Cấp đang học" htmlFor={levelId}>
          <SelectInput
            id={levelId}
            value={settings.currentLevel}
            onChange={(event) => save({ currentLevel: Number(event.target.value) })}
            className="max-w-40"
          >
            {Array.from({ length: maxLevel }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>
                {level === 7 ? 'Bậc 7–9' : `Cấp ${level}`}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Từ mới mỗi ngày" hint="Người mới: 5 từ trong 2 tuần đầu, sau đó 8 từ.">
          <NumberInput
            key={`new-${settings.newWordsPerDay}`}
            value={settings.newWordsPerDay}
            min={0}
            max={50}
            onCommit={(newWordsPerDay) => save({ newWordsPerDay })}
          />
        </Field>
        <Field label="Số lượt ôn tối đa/ngày" hint="Phần vượt quá sẽ thành backlog và hiện ở màn chờ ôn tập.">
          <NumberInput
            key={`max-${settings.maxReviewsPerDay}`}
            value={settings.maxReviewsPerDay}
            min={10}
            max={1000}
            onCommit={(maxReviewsPerDay) => save({ maxReviewsPerDay })}
          />
        </Field>
        <Field label="Số câu mỗi lượt" hint="Sau mỗi lượt có nút “Tiếp tục”.">
          <NumberInput
            key={`session-${settings.sessionSize}`}
            value={settings.sessionSize}
            min={5}
            max={100}
            onCommit={(sessionSize) => save({ sessionSize })}
          />
        </Field>
        <Field label="Kỹ năng luyện" hint="Nghe mở sau 1 lần ôn đúng, nói sau 2 lần, viết theo từng chữ sau 3 lần. Đọc luôn bật.">
          <div className="space-y-2">
            {(
              [
                ['listen', 'Nghe (audio → chữ, nghĩa, thanh điệu)'],
                ['speak', 'Nói (cần micro và trình duyệt hỗ trợ nhận dạng)'],
                ['write', 'Viết theo nét (từng chữ Hán, hoạt động offline)'],
              ] as const
            ).map(([facet, label]) => (
              <label key={facet} className="flex items-center gap-3 text-sm text-sub">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={settings.enabledFacets.includes(facet)}
                  onChange={(event) =>
                    save({
                      enabledFacets: event.target.checked
                        ? [...settings.enabledFacets, facet]
                        : settings.enabledFacets.filter((item) => item !== facet),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Xếp cấp nhanh" hint="Đánh dấu cả một cấp HSK là “đã biết”, khỏi phải học lại từng từ.">
          <PlacementControl settings={settings} />
        </Field>
        <Field label="Mục tiêu mỗi ngày">
          <SelectInput
            value={settings.dailyGoalXp}
            onChange={(event) => save({ dailyGoalXp: Number(event.target.value) as Settings['dailyGoalXp'] })}
            className="max-w-60"
          >
            <option value={50}>Nhẹ nhàng · 50 XP</option>
            <option value={150}>Vừa phải · 150 XP</option>
            <option value={300}>Chăm chỉ · 300 XP</option>
          </SelectInput>
        </Field>
        <Field label="Ngày mới bắt đầu lúc" hint="Học sau nửa đêm vẫn tính cho hôm trước nếu chọn giờ muộn hơn 00:00.">
          <SelectInput
            value={settings.dayStartHour}
            onChange={(event) => save({ dayStartHour: Number(event.target.value) })}
            className="max-w-40"
          >
            {Array.from({ length: 7 }, (_, hour) => (
              <option key={hour} value={hour}>
                {`${String(hour).padStart(2, '0')}:00`}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Card>
  );
}

function SchedulerCard({ settings }: { settings: Settings }) {
  const [comparison, setComparison] = useState<SchedulerComparison | null>(null);
  const [busy, setBusy] = useState(false);

  const compare = () => {
    setBusy(true);
    loadReviewHistories()
      .then((histories) => {
        setComparison(compareSchedulers(histories, [sm2, fsrsScheduler]));
        setBusy(false);
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
        setBusy(false);
      });
  };

  const changeScheduler = (next: Settings['scheduler']) => {
    if (next === settings.scheduler) return;
    if (!window.confirm(`Chuyển sang ${SCHEDULER_LABELS[next]}? HanziStep sẽ tính lại lịch từ nhật ký và giữ lịch ${SCHEDULER_LABELS[settings.scheduler]} để có thể quay lại.`)) return;
    setBusy(true);
    void switchScheduler(next).then(
      (result) => {
        toast.success(`Đã chuyển ${result.cards} thẻ; tính lại ${result.replayed} thẻ từ lịch sử.`);
        setBusy(false);
      },
      (error: unknown) => {
        toast.error(errorMessage(error));
        setBusy(false);
      },
    );
  };

  return (
    <Card
      title="Thuật toán ôn tập"
      description="Mỗi thuật toán giữ lịch riêng; khi đổi, lịch đích được khôi phục hoặc tính lại nguyên tử từ nhật ký."
    >
      <div className="space-y-4">
        <Field label="Thuật toán">
          <SelectInput
            value={settings.scheduler}
            onChange={(event) => changeScheduler(event.target.value as Settings['scheduler'])}
            disabled={busy}
            className="max-w-80"
          >
            {(Object.keys(SCHEDULER_LABELS) as Settings['scheduler'][]).map((id) => (
              <option key={id} value={id}>
                {SCHEDULER_LABELS[id]}
              </option>
            ))}
          </SelectInput>
        </Field>

        <div>
          <Button variant="outline" size="sm" onClick={compare} disabled={busy}>
            {busy ? 'Đang tính…' : 'So sánh trên lịch sử của bạn'}
          </Button>
          {comparison && (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr>
                  <th className="py-1">Thuật toán</th>
                  <th className="py-1">Giãn cách TB</th>
                  <th className="py-1">Đến hạn trong 1 ngày</th>
                  <th className="py-1">Dài nhất</th>
                </tr>
              </thead>
              <tbody>
                {comparison.byScheduler.map((entry) => (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="py-1 text-fg">{entry.id === 'sm2' ? 'SM-2' : 'FSRS'}</td>
                    <td className="py-1 text-sub">{entry.summary.averageIntervalDays.toFixed(1)} ngày</td>
                    <td className="py-1 text-sub">{entry.summary.dueWithinADay}</td>
                    <td className="py-1 text-sub">{entry.summary.longestIntervalDays.toFixed(0)} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {comparison && comparison.byScheduler[0]?.summary.cards === 0 && (
            <p className="mt-2 text-sm text-sub">Chưa có lượt ôn nào để so sánh.</p>
          )}
          <p className="mt-2 text-xs text-muted">
            Tính lại từ nhật ký ôn tập ({MAX_REPLAY_CARDS} thẻ gần nhất), không đụng tới thẻ đang có.
          </p>
        </div>
      </div>
    </Card>
  );
}

function DisplayCard({ settings }: { settings: Settings }) {
  const pinyinId = useId();
  const toneId = useId();
  const musicId = useId();
  return (
    <Card title="Hiển thị & âm thanh">
      <div className="space-y-4">
        <Field label="Giao diện">
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((theme) => (
              <Button
                key={theme}
                variant={settings.theme === theme ? 'primary' : 'outline'}
                onClick={() => save({ theme })}
              >
                {theme === 'dark' ? 'Tối' : 'Sáng'}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Hiện pinyin khi đọc" htmlFor={pinyinId}>
          <SelectInput
            id={pinyinId}
            value={settings.pinyinDisplay}
            onChange={(event) => save({ pinyinDisplay: event.target.value as PinyinDisplay })}
            className="max-w-60"
          >
            <option value="all">Tất cả các từ</option>
            <option value="unknown">Chỉ từ chưa biết</option>
            <option value="none">Ẩn</option>
          </SelectInput>
        </Field>
        <Field label="Tô màu thanh điệu" htmlFor={toneId}>
          <div className="flex items-center gap-4">
            <Switch
              id={toneId}
              label="Tô màu thanh điệu"
              checked={settings.toneColors}
              onChange={(toneColors) => save({ toneColors })}
            />
            <span className="pt-2 text-lg font-semibold">
              {TONE_PREVIEW.map((tone) => (
                <span key={tone.text} className={`mr-2 ${settings.toneColors ? tone.className : 'text-fg'}`}>
                  {tone.text}
                </span>
              ))}
            </span>
          </div>
        </Field>
        <Field label="Tự phát nhạc nền" htmlFor={musicId} hint="Nhạc bắt đầu sau lần bấm hoặc gõ phím đầu tiên.">
          <Switch
            id={musicId}
            label="Tự phát nhạc nền"
            checked={settings.musicAutoplay}
            onChange={(musicAutoplay) => save({ musicAutoplay })}
          />
        </Field>
      </div>
    </Card>
  );
}

function StorageCard() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    buildStorageReport().then(setReport, (error: unknown) => toast.error(errorMessage(error)));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const run = (action: () => Promise<string>) => {
    setBusy(true);
    action()
      .then((message) => {
        toast.success(message);
        setBusy(false);
        refresh();
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
        setBusy(false);
      });
  };

  return (
    <Card title="Dung lượng" description="Từ điển và ảnh chiếm nhiều chỗ nhất; cả hai đều tải lại được.">
      {!report ? (
        <p className="text-sm text-sub">Đang đo…</p>
      ) : (
        <div className="space-y-4">
          <table className="w-full text-left text-sm">
            <tbody>
              {report.tables
                .filter((usage) => usage.rows > 0 || (usage.bytes ?? 0) > 0)
                .map((usage) => (
                  <tr key={usage.table} className="border-b border-line/60">
                    <td className="py-1 text-fg">{usage.label}</td>
                    <td className="py-1 text-right text-sub">{usage.rows.toLocaleString('vi-VN')} mục</td>
                    <td className="py-1 text-right text-muted">{usage.bytes === undefined ? '' : formatBytes(usage.bytes)}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || report.imageCount === 0}
              onClick={() =>
                run(async () => {
                  const plan = await trimImageCache();
                  return plan.evict.length > 0
                    ? `Đã xoá ${plan.evict.length} ảnh cũ, giải phóng ${formatBytes(plan.freedBytes)}.`
                    : 'Ảnh đang nằm trong hạn mức, không cần dọn.';
                })
              }
            >
              Dọn ảnh cũ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || report.dictionaryRows === 0}
              onClick={() => {
                if (!window.confirm('Xoá từ điển khỏi máy? Lần mở app sau sẽ tự nạp lại từ gói dữ liệu.')) return;
                run(async () => {
                  await clearDictionary();
                  resetDictionaryHeadwords();
                  return 'Đã xoá từ điển; app sẽ nạp lại khi rảnh.';
                });
              }}
            >
              Xoá từ điển
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [hasFolder, setHasFolder] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  // Freshness is decided once, when the timestamp is read: the clock must not be consulted during render.
  const [remind, setRemind] = useState(false);

  useEffect(() => {
    void getStorageStatus().then(setStorage);
    void getBackupFolder().then((handle) => setHasFolder(handle !== null));
    void getLastBackupAt().then((at) => {
      setLastBackupAt(at);
      setRemind(shouldRemind(at, Date.now()));
    });
  }, []);

  const handleExport = async () => {
    setBusy(true);
    try {
      downloadBackup(await createBackup({ includeSecrets }));
      toast.success('Đã tạo bản sao lưu.');
    } catch (error) {
      toast.error(`Không tạo được bản sao lưu: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    try {
      const backup = await readBackupFile(file);
      const exportedAt = new Date(backup.exportedAt).toLocaleString('vi-VN');
      const confirmed = window.confirm(
        `Khôi phục bản sao lưu ngày ${exportedAt}?\n\n` +
          'Toàn bộ dữ liệu học hiện tại trên máy này sẽ bị thay thế. Bản sao lưu chứa:\n' +
          `• ${backup.data.words.length} từ, ${backup.data.cards.length} thẻ\n` +
          `• ${backup.data.reviewLogs.length} lượt ôn, ${backup.data.dailyStats.length} ngày thống kê\n` +
          `• ${backup.data.texts.length} bài đọc/nghe, ${backup.data.coachSessions.length} phiên Coach\n` +
          `• ${backup.images.length} ảnh đã lưu`,
      );
      if (!confirmed) return;
      const summary = await restoreBackup(backup);
      toast.success(`Đã khôi phục ${summary.counts.words} từ, ${summary.counts.cards} thẻ và ${summary.images} ảnh.`);
    } catch (error) {
      toast.error(error instanceof BackupError ? error.message : `Khôi phục thất bại: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Card
      title="Sao lưu & khôi phục"
      description="Không có đồng bộ đám mây: hãy sao lưu định kỳ, nhất là trước khi xoá dữ liệu trình duyệt."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleExport()} disabled={busy}>
            Tải bản sao lưu (JSON)
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
            Khôi phục từ tệp…
          </Button>
          {autoBackupSupported() && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  pickBackupFolder()
                    .then(() => {
                      setHasFolder(true);
                      setBusy(false);
                      toast.success('Đã chọn thư mục sao lưu.');
                    })
                    .catch((error: unknown) => {
                      setBusy(false);
                      // The learner closing the picker is not an error worth shouting about.
                      if (error instanceof DOMException && error.name === 'AbortError') return;
                      toast.error(errorMessage(error));
                    });
                }}
              >
                {hasFolder ? 'Đổi thư mục…' : 'Chọn thư mục sao lưu…'}
              </Button>
              {hasFolder && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    backupToFolder({ includeSecrets })
                      .then((result) => {
                        setLastBackupAt(result.at);
                        setRemind(false);
                        setBusy(false);
                        toast.success(`Đã ghi ${result.fileName} vào thư mục đã chọn.`);
                      })
                      .catch((error: unknown) => {
                        setBusy(false);
                        toast.error(errorMessage(error));
                      });
                  }}
                >
                  Sao lưu vào thư mục
                </Button>
              )}
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>
        <p className={`text-sm ${remind ? 'text-warning' : 'text-sub'}`}>
          {lastBackupAt === null
            ? 'Chưa sao lưu lần nào. Nên sao lưu mỗi tuần một lần.'
            : `Lần sao lưu gần nhất: ${new Date(lastBackupAt).toLocaleString('vi-VN')}.${
                remind ? ' Đã hơn một tuần — nên sao lưu lại.' : ''
              }`}
          {!autoBackupSupported() && ' Trình duyệt này chưa hỗ trợ ghi thẳng vào thư mục, hãy dùng nút tải về.'}
        </p>
        <label className="flex items-center gap-2 text-sm text-sub">
          <input
            type="checkbox"
            checked={includeSecrets}
            onChange={(event) => setIncludeSecrets(event.target.checked)}
            className="accent-primary"
          />
          Kèm API key trong bản sao lưu
        </label>
        <div className="rounded-xl bg-surface-2 p-3 text-sm text-sub">
          {storage ? (
            <>
              {storage.persisted ? 'Đã bật lưu trữ bền.' : 'Chưa bật lưu trữ bền — trình duyệt có thể xoá dữ liệu khi thiếu dung lượng.'}{' '}
              Đang dùng {formatBytes(storage.usageBytes)} / {formatBytes(storage.quotaBytes)}.
              {!storage.persisted && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() =>
                    void requestPersistentStorage().then((granted) => {
                      toast[granted ? 'success' : 'error'](
                        granted ? 'Đã bật lưu trữ bền.' : 'Trình duyệt chưa cho phép. Cài app (PWA) thường giúp được cấp quyền.',
                      );
                      return getStorageStatus().then(setStorage);
                    })
                  }
                >
                  Yêu cầu lưu trữ bền
                </Button>
              )}
            </>
          ) : (
            'Trình duyệt không cung cấp thông tin dung lượng.'
          )}
        </div>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const settings = useLoadedSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={vi.nav.settings}
        subtitle="Mọi dữ liệu nằm trên máy này (IndexedDB)."
        actions={
          <div className="flex flex-wrap gap-4">
            <Link to="/settings/voices" className="text-sm text-primary hover:underline">
              Kiểm tra giọng đọc
            </Link>
            <Link to="/settings/sources" className="text-sm text-primary hover:underline">
              {vi.nav.sources}
            </Link>
          </div>
        }
      />
      {settings ? (
        <>
          <ApiKeysCard settings={settings} />
          <LearningCard settings={settings} />
          <SchedulerCard settings={settings} />
          <DisplayCard settings={settings} />
          <VoiceCard settings={settings} />
          <ModelsCard settings={settings} />
          <StorageCard />
          <BackupCard />
        </>
      ) : (
        <p className="text-sub">{vi.common.loading}</p>
      )}
      <p className="text-center text-xs text-muted">HanziStep {__APP_VERSION__}</p>
    </div>
  );
}
