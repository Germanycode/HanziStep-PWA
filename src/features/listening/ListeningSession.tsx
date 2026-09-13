import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CircleCheck, Ear, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { longestMatchAt } from '@/chinese/segment/segment';
import { sentenceTiles } from '@/chinese/text';
import { useDictionaryStatus } from '@/data/dictImport';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import { ComprehensionPanel } from '@/features/reading/ComprehensionPanel';
import { prepareText, type PreparedText, type RenderToken } from '@/features/reading/pipeline';
import { completeText, getText, markTextOpened, rewardComprehension, setReadingPosition } from '@/features/reading/repository';
import { SentenceView } from '@/features/reading/SentenceView';
import { WordPopover, type PopoverTarget } from '@/features/reading/WordPopover';
import { announceActivity } from '@/progress/announce';
import { listChineseVoices, speak, stopSpeaking } from '@/services/speech/tts';
import type { VoiceInfo } from '@/services/speech/voices';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import { DictationPanel } from './DictationPanel';

type Phase = 'blind' | 'questions' | 'transcript' | 'dictation';

const SPEEDS = [0.6, 0.8, 1] as const;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Listening room: hear it first, answer, then read the transcript (docs/PLAN.md §8.3). */
export function ListeningSession() {
  const { textId = '' } = useParams();
  const settings = useSettings();
  const dictStatus = useDictionaryStatus((state) => state.status);
  const doc = useLiveQuery(async () => (await getText(textId)) ?? null, [textId]);
  const data = useLiveQuery(async () => ({ words: await db.words.toArray(), cards: await db.cards.toArray() }), []);

  const [phase, setPhase] = useState<Phase>('blind');
  const [prepared, setPrepared] = useState<PreparedText | null>(null);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [target, setTarget] = useState<PopoverTarget | null>(null);
  const audioRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (doc) void markTextOpened(doc.id);
  }, [doc]);

  useEffect(() => {
    let active = true;
    listChineseVoices().then(
      (found) => {
        if (active) setVoices(found);
      },
      () => {},
    );
    return () => {
      active = false;
      audioRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  // The transcript needs the same pipeline as the reader.
  useEffect(() => {
    // Prepared as soon as the blind listening is over, so dictation has it too.
    if (!doc || !data || phase === 'blind') return;
    let active = true;
    prepareText(doc, { words: data.words, cards: data.cards }).then(
      (result) => {
        if (active) setPrepared(result);
      },
      (error: unknown) => {
        if (active) toast.error(errorText(error));
      },
    );
    return () => {
      active = false;
    };
  }, [doc, data, phase, dictStatus]);

  const voiceFor = (speaker?: string): string | undefined => {
    const first = voices[0]?.voiceURI;
    const second = voices[1]?.voiceURI ?? first;
    return speaker === 'B' ? second : first;
  };

  const stop = () => {
    audioRef.current?.abort();
    stopSpeaking();
    setPlaying(false);
  };

  const play = async (from: number) => {
    if (!doc) return;
    audioRef.current?.abort();
    const controller = new AbortController();
    audioRef.current = controller;
    setPlaying(true);
    if (from === 0) setPlays((count) => count + 1);
    try {
      for (let index = from; index < doc.sentences.length; index++) {
        if (controller.signal.aborted) break;
        const sentence = doc.sentences[index];
        if (!sentence) break;
        setActiveIndex(index);
        void setReadingPosition(textId, index);
        await speak(sentence.zh, {
          rate: settings.ttsRate * speed,
          voiceURI: voiceFor(sentence.speaker),
          signal: controller.signal,
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) toast.error(`Không đọc được: ${errorText(error)}`);
    } finally {
      if (!controller.signal.aborted) {
        setPlaying(false);
        setActiveIndex(-1);
      }
    }
  };

  const openPopover = (sentenceIndex: number, token: RenderToken, anchor: HTMLElement) => {
    if (!prepared) return;
    const sentence = prepared.sentences[sentenceIndex];
    if (!sentence) return;
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
      const activity = await completeText(textId, 'listen');
      if (activity) announceActivity(activity, 'Nghe xong hội thoại');
      else toast('Bài này đã được tính điểm rồi.');
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  if (doc === undefined) return <p className="text-sub">Đang tải…</p>;
  if (doc === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Không tìm thấy hội thoại" />
        <Link to="/listening" className="text-primary hover:underline">
          Về danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/listening" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Nghe & Nói
      </Link>
      <PageHeader
        title={phase === 'blind' ? 'Nghe trước, chưa nhìn chữ' : doc.title}
        subtitle={phase === 'blind' ? `${doc.sentences.length} lượt · đã nghe ${plays} lần` : (doc.titleVi ?? '')}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => (playing ? stop() : void play(0))}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {playing ? 'Dừng' : plays === 0 ? 'Nghe hội thoại' : 'Nghe lại'}
          </Button>
          <SelectInput aria-label="Tốc độ" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="max-w-24">
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </SelectInput>
          {voices.length < 2 && (
            <span className="text-xs text-muted">Máy chỉ có một giọng tiếng Trung nên hai người nói nghe giống nhau.</span>
          )}
        </div>

        {phase === 'blind' && (
          <div className="mt-5 space-y-3">
            <ol className="space-y-2">
              {doc.sentences.map((sentence, index) => (
                <li
                  key={index}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${activeIndex === index ? 'bg-primary/10' : 'bg-surface-2/50'}`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-sub">
                    {sentence.speaker ?? 'A'}
                  </span>
                  <span className="flex gap-1" aria-hidden>
                    {Array.from({ length: Math.min(12, Math.max(3, Math.round(sentence.zh.length / 2))) }, (_, dot) => (
                      <span key={dot} className="size-2 rounded-full bg-line" />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-sub">
              <Ear className="mr-1 inline size-4" aria-hidden />
              Nghe vài lần rồi trả lời câu hỏi. Lời thoại hiện ra sau đó.
            </p>
            <Button onClick={() => setPhase(doc.questions.length > 0 ? 'questions' : 'transcript')} disabled={plays === 0}>
              {doc.questions.length > 0 ? 'Tôi nghe xong, sang câu hỏi' : 'Xem lời thoại'}
            </Button>
          </div>
        )}
      </Card>

      {phase === 'questions' && (
        <>
          <ComprehensionPanel
            questions={doc.questions}
            answered={doc.progress.comprehensionDone}
            title="Câu hỏi nghe hiểu"
            description="Trả lời bằng những gì bạn nghe được."
            onAnswered={(index) =>
              void rewardComprehension(textId, index).then(
                (activity) => {
                  if (activity) announceActivity(activity, 'Nghe hiểu');
                },
                () => {},
              )
            }
          />
          <Button onClick={() => setPhase('transcript')}>Xem lời thoại</Button>
        </>
      )}

      {phase === 'transcript' && (
        <Card title="Lời thoại" description="Chạm vào từ để tra nghĩa, bấm loa để nghe lại từng câu.">
          {!prepared ? (
            <p className="text-sub">Đang tách từ…</p>
          ) : (
            <div className="space-y-2">
              {prepared.sentences.map((sentence) => (
                <div key={sentence.index} className="flex gap-2">
                  <span className="mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-sub">
                    {doc.sentences[sentence.index]?.speaker ?? 'A'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SentenceView
                      sentence={sentence}
                      pinyinMode={settings.pinyinDisplay}
                      toneColors={settings.toneColors}
                      active={activeIndex === sentence.index}
                      dictReady={dictStatus === 'ready'}
                      showVi
                      selectedStart={target?.sentenceIndex === sentence.index ? target.token.start : undefined}
                      onTokenClick={(token, anchor) => openPopover(sentence.index, token, anchor)}
                      onPlay={() => void play(sentence.index)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {phase === 'transcript' && prepared && (
        <Button variant="outline" onClick={() => setPhase('dictation')}>
          Luyện chính tả
        </Button>
      )}

      {phase === 'dictation' && (
        <DictationPanel
          items={(prepared?.sentences ?? []).map((sentence) => ({
            index: sentence.index,
            zh: sentence.zh,
            pinyinNum: sentence.tokens
              .filter((token) => token.kind === 'word' && token.pinyinNum)
              .map((token) => token.pinyinNum)
              .join(' '),
            tiles: sentenceTiles(sentence.zh),
          }))}
          onPlay={(index) => void play(index)}
          onBack={() => setPhase('transcript')}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void finish()} disabled={Boolean(doc.progress.completedAt)}>
          <CircleCheck className="size-4" aria-hidden /> {doc.progress.completedAt ? 'Đã hoàn thành' : 'Hoàn thành bài nghe'}
        </Button>
      </div>

      {target && (
        <WordPopover
          target={target}
          textId={textId}
          onClose={() => setTarget(null)}
          onSplit={() => setTarget(null)}
          onMerge={() => setTarget(null)}
          onChanged={() => {
            /* words and cards are live queries, so the transcript recolours itself */
          }}
        />
      )}
    </div>
  );
}
