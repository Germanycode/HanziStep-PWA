import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Mic, Play, Sparkles, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { loadWordAudioIndex, wordAudioUrl } from '@/data/wordAudio';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import type { Word } from '@/domain/types';
import { announceActivity } from '@/progress/announce';
import { recordActivity } from '@/progress/recordActivity';
import { gradePronunciation, type PronunciationFeedback } from '@/services/ai/gemini';
import { playClip } from '@/services/audio/clips';
import { classifyTone, pitchCurve, toSemitones, type PitchPoint, type SemitonePoint } from '@/services/speech/pitch';
import { blobToBase64, decodeToMono, loadAudioSamples, recorderSupport, VoiceRecorder, type Recording } from '@/services/speech/recorder';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { PinyinText } from '@/ui/PinyinText';
import { SelectInput } from '@/ui/form';
import { curveSegments, hasVoice } from './curve';

const BOX = { width: 320, height: 90 };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function CurveChart({ model, mine }: { model: SemitonePoint[]; mine: SemitonePoint[] }) {
  return (
    <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} className="h-24 w-full" role="img" aria-label="Đường cao độ">
      <line x1="0" y1={BOX.height / 2} x2={BOX.width} y2={BOX.height / 2} className="stroke-line" strokeDasharray="4 4" />
      {curveSegments(model, BOX).map((path, index) => (
        <path key={`model-${index}`} d={path} className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ))}
      {curveSegments(mine, BOX).map((path, index) => (
        <path key={`mine-${index}`} d={path} className="stroke-accent" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** Shadowing: hear the real recording, say it, compare the pitch curves (docs/PLAN.md §8.4). */
export function ShadowingPage() {
  const settings = useSettings();
  const [support] = useState(() => recorderSupport());
  const [recorder] = useState(() => new VoiceRecorder());
  const [available, setAvailable] = useState<Word[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [modelCurve, setModelCurve] = useState<SemitonePoint[]>([]);
  // The raw curve is kept because the tone classifier needs real frequencies.
  const [myRawCurve, setMyRawCurve] = useState<PitchPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState<Recording | null>(null);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const takeRef = useRef<Recording | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const words = useLiveQuery(() => db.words.toArray(), []);
  const myCurve = useMemo(() => toSemitones(myRawCurve), [myRawCurve]);

  // Only words with a real recording: a TTS voice cannot be captured for comparison.
  useEffect(() => {
    if (!words) return;
    let active = true;
    loadWordAudioIndex().then(
      (index) => {
        if (!active) return;
        const usable = words.filter((word) => index.has(word.simplified));
        setAvailable(usable);
        setSelectedId((current) => current || (usable[0]?.id ?? ''));
      },
      () => {
        if (active) setAvailable([]);
      },
    );
    return () => {
      active = false;
    };
  }, [words]);

  const word = available?.find((item) => item.id === selectedId);

  // The model curve comes from the shipped audio file, not from TTS.
  useEffect(() => {
    if (!word) return;
    let active = true;
    loadAudioSamples(wordAudioUrl(word.simplified)).then(
      ({ samples, sampleRate }) => {
        if (active) setModelCurve(toSemitones(pitchCurve(samples, sampleRate)));
      },
      () => {
        if (active) setModelCurve([]);
      },
    );
    return () => {
      active = false;
    };
  }, [word]);

  useEffect(
    () => () => {
      recorder.cancel();
      aiAbortRef.current?.abort();
      if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
    },
    [recorder],
  );

  const start = async () => {
    setFeedback(null);
    setMyRawCurve([]);
    try {
      await recorder.start((error) => {
        setRecording(false);
        toast.error(error.message);
      });
      setRecording(true);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const stop = async () => {
    try {
      const result = await recorder.stop();
      setRecording(false);
      if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
      takeRef.current = result;
      setTake(result);
      const { samples, sampleRate } = await decodeToMono(result.blob);
      setMyRawCurve(pitchCurve(samples, sampleRate));
      const activity = await recordActivity({ kind: 'shadowing' });
      announceActivity(activity, 'Luyện nhại');
    } catch (error) {
      setRecording(false);
      toast.error(errorText(error));
    }
  };

  const askAi = async () => {
    if (!word || !take) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setBusy(true);
    try {
      const result = await gradePronunciation({
        apiKey: settings.geminiApiKey,
        model: settings.geminiTextModel,
        hanzi: word.simplified,
        pinyinNum: word.pinyinNum,
        audio: { mimeType: take.blob.type || 'audio/webm', dataBase64: await blobToBase64(take.blob) },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setFeedback(result);
    } catch (error) {
      if (!controller.signal.aborted) toast.error(errorText(error));
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setBusy(false);
      }
    }
  };

  const singleSyllable = word ? [...word.simplified].length === 1 : false;
  const myTone = singleSyllable && hasVoice(myCurve) ? classifyTone(myRawCurve) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/listening" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Nghe & Nói
      </Link>
      <PageHeader title="Luyện nhại" subtitle="Nghe bản thu thật, nói theo, rồi so đường cao độ của bạn với bản mẫu." />

      {!support.supported && <Card title="Không ghi âm được">{support.note}</Card>}

      <Card>
        {available === null && <p className="text-sub">Đang tìm từ có bản ghi âm…</p>}
        {available?.length === 0 && (
          <p className="text-sub">
            Chưa có từ nào của bạn có bản ghi âm thật.{' '}
            <Link to="/learn" className="text-primary hover:underline">
              Học vài từ HSK
            </Link>{' '}
            rồi quay lại.
          </p>
        )}
        {available && available.length > 0 && (
          <div className="space-y-4">
            <SelectInput
              aria-label="Chọn từ"
              value={selectedId}
              onChange={(event) => {
                recorder.cancel();
                setRecording(false);
                aiAbortRef.current?.abort();
                aiAbortRef.current = null;
                setBusy(false);
                if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
                takeRef.current = null;
                setTake(null);
                setSelectedId(event.target.value);
                setMyRawCurve([]);
                setFeedback(null);
              }}
              className="max-w-xs"
            >
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.simplified} · {item.meaningVi[0] ?? ''}
                </option>
              ))}
            </SelectInput>

            {word && (
              <>
                <div className="text-center">
                  <p className="font-hanzi text-5xl text-fg">{word.simplified}</p>
                  <PinyinText pinyin={word.pinyinNum} className="mt-1 block text-lg" />
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => void playClip(wordAudioUrl(word.simplified)).catch(() => toast.error('Không phát được mẫu.'))}>
                    <Play className="size-4" aria-hidden /> Nghe mẫu
                  </Button>
                  {support.supported &&
                    (recording ? (
                      <Button variant="danger" onClick={() => void stop()}>
                        <Square className="size-4" aria-hidden /> Dừng
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => void start()}>
                        <Mic className="size-4" aria-hidden /> Ghi âm
                      </Button>
                    ))}
                  {take && (
                    <Button variant="ghost" onClick={() => void playClip(take.url).catch(() => {})}>
                      Nghe lại giọng bạn
                    </Button>
                  )}
                </div>

                <div className="rounded-xl bg-surface-2/50 p-3">
                  <CurveChart model={modelCurve} mine={myCurve} />
                  <p className="flex flex-wrap gap-x-4 text-xs text-muted">
                    <span className="text-primary">— bản mẫu</span>
                    <span className="text-accent">— giọng bạn</span>
                    <span>Cao độ đã chuẩn hoá theo semitone quanh giọng trung bình của mỗi người.</span>
                  </p>
                  {modelCurve.length === 0 && <p className="text-xs text-warning">Không đọc được bản ghi mẫu của từ này.</p>}
                </div>

                {myTone && (
                  <p className="text-center text-sm text-sub">
                    Máy đoán bạn vừa nói <strong className="text-fg">thanh {myTone}</strong>{' '}
                    <span className="text-muted">(thử nghiệm — chỉ tham khảo)</span>
                  </p>
                )}

                {settings.geminiApiKey && take && (
                  <div className="text-center">
                    <Button variant="ghost" onClick={() => void askAi()} disabled={busy}>
                      <Sparkles className="size-4" aria-hidden /> {busy ? 'Đang nghe…' : 'Nhờ AI nhận xét'}
                    </Button>
                  </div>
                )}

                {feedback && (
                  <div className="space-y-2 rounded-xl bg-surface-2 p-3">
                    <p className="text-sm text-fg">{feedback.feedbackVi}</p>
                    <ul className="space-y-1">
                      {feedback.syllables.map((note, index) => (
                        <li key={index} className="text-sm">
                          <span className={note.ok ? 'text-success' : 'text-warning'}>{note.expected}</span>{' '}
                          <span className="text-sub">{note.noteVi}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted">Đây là nhận xét của AI, không ảnh hưởng tới lịch ôn tập.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
