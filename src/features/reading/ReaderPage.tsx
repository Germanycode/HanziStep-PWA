import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CircleCheck, Minus, Pause, Play, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { longestMatchAt } from '@/chinese/segment/segment';
import { useDictionaryStatus } from '@/data/dictImport';
import { db } from '@/db/db';
import { updateSettings, useSettings } from '@/db/settings';
import type { PinyinDisplay } from '@/domain/types';
import { announceActivity } from '@/progress/announce';
import { SOURCE_LABELS } from '@/services/images/providers';
import { useStoredImage } from '@/services/images/store';
import { speak, stopSpeaking } from '@/services/speech/tts';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { SelectInput } from '@/ui/form';
import { ComprehensionPanel } from './ComprehensionPanel';
import { prepareText, type PreparedText, type RenderToken } from './pipeline';
import {
  addSegmentOverride,
  clearSegmentOverrides,
  completeText,
  getText,
  markTextOpened,
  rewardComprehension,
  setCoverage,
  setReadingPosition,
} from './repository';
import { SentenceView } from './SentenceView';
import { WordPopover, type PopoverTarget } from './WordPopover';

const SPEEDS = [0.6, 0.8, 1] as const;
const PINYIN_LABELS: Record<PinyinDisplay, string> = { all: 'Pinyin: tất cả', unknown: 'Pinyin: từ chưa thuộc', none: 'Pinyin: ẩn' };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ReaderPage() {
  const { textId = '' } = useParams();
  const settings = useSettings();
  // Segmentation needs the dictionary, so the text is prepared again once it is ready.
  const dictStatus = useDictionaryStatus((state) => state.status);
  // null = not found, undefined = still loading.
  const doc = useLiveQuery(async () => (await getText(textId)) ?? null, [textId]);
  const data = useLiveQuery(async () => ({ words: await db.words.toArray(), cards: await db.cards.toArray() }), []);
  const [prepared, setPrepared] = useState<PreparedText | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [target, setTarget] = useState<PopoverTarget | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [showVi, setShowVi] = useState(true);
  const audioRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const illustration = useStoredImage(textId, Boolean(doc?.imageUrl));

  useEffect(() => {
    if (doc) void markTextOpened(doc.id);
  }, [doc]);

  useEffect(() => {
    const end = endRef.current;
    if (!end || !doc || doc.sentences.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void setReadingPosition(doc.id, doc.sentences.length - 1);
      },
      { threshold: 0.8 },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [doc, prepared]);

  useEffect(() => {
    if (!doc || !data) return;
    let active = true;
    prepareText(doc, { words: data.words, cards: data.cards }).then(
      (result) => {
        if (!active) return;
        setPrepared(result);
        setPrepareError(null);
        void setCoverage(doc.id, Math.round(result.knownShare * 100) / 100);
      },
      (error: unknown) => {
        if (active) setPrepareError(errorText(error));
      },
    );
    return () => {
      active = false;
    };
  }, [doc, data, dictStatus]);

  useEffect(
    () => () => {
      audioRef.current?.abort();
      stopSpeaking();
    },
    [],
  );

  const stop = () => {
    audioRef.current?.abort();
    stopSpeaking();
    setPlaying(false);
  };

  const playFrom = async (index: number) => {
    if (!prepared) return;
    audioRef.current?.abort();
    const controller = new AbortController();
    audioRef.current = controller;
    setPlaying(true);
    try {
      for (let position = index; position < prepared.sentences.length; position++) {
        if (controller.signal.aborted) break;
        setActiveIndex(position);
        void setReadingPosition(textId, position);
        const sentence = prepared.sentences[position];
        if (!sentence) break;
        await speak(sentence.zh, {
          rate: settings.ttsRate * speed,
          voiceURI: settings.ttsVoiceURI || undefined,
          signal: controller.signal,
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) toast.error(`Không đọc được: ${errorText(error)}`);
    } finally {
      if (!controller.signal.aborted) setPlaying(false);
    }
  };

  const openPopover = (sentenceIndex: number, token: RenderToken, anchor: HTMLElement) => {
    if (!prepared) return;
    const sentence = prepared.sentences[sentenceIndex];
    if (!sentence) return;
    setActiveIndex(sentenceIndex);
    void setReadingPosition(textId, sentenceIndex);
    setTarget({
      token,
      candidates: longestMatchAt(sentence.zh, token.start, prepared.lexicon),
      sentenceIndex,
      sentence: sentence.zh,
      sentenceVi: sentence.vi,
      anchor: anchor.getBoundingClientRect(),
    });
  };

  const finish = async () => {
    try {
      const activity = await completeText(textId, 'read');
      if (activity) announceActivity(activity, 'Đọc xong bài');
      else toast('Bài này đã được tính điểm rồi.');
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  if (doc === undefined) return <p className="text-sub">Đang tải…</p>;
  if (doc === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Không tìm thấy bài đọc" />
        <Link to="/reading" className="text-primary hover:underline">
          Về thư viện
        </Link>
      </div>
    );
  }

  const targets = doc.targetWordIds.length;
  const found = prepared?.targetsFound.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/reading" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Thư viện
      </Link>
      <PageHeader
        title={doc.title}
        subtitle={[doc.titleVi, doc.level ? `HSK ${doc.level}` : null, `${doc.sentences.length} câu`].filter(Boolean).join(' · ')}
      />

      {illustration && (
        <img
          src={illustration.url}
          alt=""
          title={`${illustration.author} · ${SOURCE_LABELS[illustration.source]}`}
          className="h-40 w-full rounded-2xl object-cover"
        />
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button size="sm" onClick={() => (playing ? stop() : void playFrom(Math.max(0, activeIndex)))}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing ? 'Dừng' : 'Đọc cả bài'}
          </Button>
          <SelectInput aria-label="Tốc độ đọc" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="max-w-24">
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </SelectInput>
          <SelectInput
            aria-label="Hiển thị pinyin"
            value={settings.pinyinDisplay}
            onChange={(event) => void updateSettings({ pinyinDisplay: event.target.value as PinyinDisplay })}
            className="max-w-48"
          >
            {(['all', 'unknown', 'none'] as PinyinDisplay[]).map((mode) => (
              <option key={mode} value={mode}>
                {PINYIN_LABELS[mode]}
              </option>
            ))}
          </SelectInput>
          <Button size="sm" variant={showVi ? 'primary' : 'outline'} onClick={() => setShowVi((value) => !value)}>
            Nghĩa tiếng Việt
          </Button>
          <span className="ml-auto inline-flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Chữ nhỏ hơn"
              onClick={() => void updateSettings({ fontScale: Math.max(0.8, Math.round((settings.fontScale - 0.1) * 10) / 10) })}
            >
              <Minus className="size-4" aria-hidden />
            </Button>
            <span className="text-xs text-muted">{Math.round(settings.fontScale * 100)}%</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Chữ to hơn"
              onClick={() => void updateSettings({ fontScale: Math.min(1.6, Math.round((settings.fontScale + 0.1) * 10) / 10) })}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </span>
        </div>

        {targets > 0 && (
          <p className="mt-3 text-sm text-sub">
            Từ mục tiêu đã gặp: <strong className="text-fg">{found}</strong>/{targets}
          </p>
        )}
        {(dictStatus === 'importing' || dictStatus === 'checking') && (
          <p className="mt-3 text-sm text-warning" data-testid="dict-loading">
            Đang nạp từ điển… việc tách từ sẽ chính xác hơn khi nạp xong.
          </p>
        )}
        {prepared && prepared.unknownWords.length > 0 && (
          <p className="mt-1 text-xs text-muted">{prepared.unknownWords.length} từ ngoài từ điển được gạch chân nét đứt.</p>
        )}
      </Card>

      <Card>
        {prepareError && <p className="text-sm text-danger">{prepareError}</p>}
        {!prepared && !prepareError && <p className="text-sub">Đang tách từ…</p>}
        {prepared && (
          <div className="space-y-2" style={{ fontSize: `${settings.fontScale}em` }} data-testid="reader-body">
            {prepared.sentences.map((sentence) => (
              <SentenceView
                key={sentence.index}
                sentence={sentence}
                pinyinMode={settings.pinyinDisplay}
                toneColors={settings.toneColors}
                active={activeIndex === sentence.index}
                dictReady={dictStatus === 'ready'}
                showVi={showVi}
                selectedStart={target?.sentenceIndex === sentence.index ? target.token.start : undefined}
                onTokenClick={(token, anchor) => openPopover(sentence.index, token, anchor)}
                onPlay={() => void playFrom(sentence.index)}
              />
            ))}
            <div ref={endRef} className="h-px" aria-hidden />
          </div>
        )}
      </Card>

      <ComprehensionPanel
        questions={doc.questions}
        answered={doc.progress.comprehensionDone}
        title="Câu hỏi đọc hiểu"
        description="Trả lời sau khi đọc xong bài."
        onAnswered={(index) =>
          void rewardComprehension(textId, index).then(
            (activity) => {
              if (activity) announceActivity(activity, 'Đọc hiểu');
            },
            () => {},
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void finish()} disabled={Boolean(doc.progress.completedAt)}>
          <CircleCheck className="size-4" aria-hidden /> {doc.progress.completedAt ? 'Đã hoàn thành' : 'Hoàn thành bài đọc'}
        </Button>
        <Link to="/learn" className="text-sm text-primary hover:underline">
          Học những từ vừa lưu
        </Link>
      </div>

      {target && (
        <WordPopover
          target={target}
          textId={textId}
          onClose={() => setTarget(null)}
          onSplit={(span) => {
            void addSegmentOverride(textId, target.sentenceIndex, span);
            setTarget(null);
          }}
          onMerge={(span) => {
            void addSegmentOverride(textId, target.sentenceIndex, span);
            setTarget(null);
          }}
          onChanged={() => {
            /* words and cards are live queries, so the reader recolours itself */
          }}
        />
      )}

      {prepared && Object.keys(doc.segOverrides).length > 0 && (
        <button
          type="button"
          className="text-xs text-muted hover:text-fg"
          onClick={() => {
            for (const key of Object.keys(doc.segOverrides)) void clearSegmentOverrides(textId, Number(key));
          }}
        >
          Bỏ mọi chỉnh sửa tách/gộp từ
        </button>
      )}
    </div>
  );
}
