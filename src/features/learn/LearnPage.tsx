import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { loadHskUpTo, levelLabel, MAX_LEVEL, TRACK_LABELS } from '@/data/hsk';
import type { HskTrackKey, HskWordRecord } from '@/data/types';
import { db } from '@/db/db';
import { updateSettings, useLoadedSettings } from '@/db/settings';
import type { Settings, Word } from '@/domain/types';
import { answerCard } from '@/features/review/engine/answerCard';
import { buildCandidatePool, wordToCandidate } from '@/features/review/engine/candidates';
import { meaningDistractors, type DistractorCandidate } from '@/features/review/engine/distractors';
import { remainingNewWords, wordKey } from '@/features/review/engine/session';
import { ChoiceGrid, type ChoiceOption } from '@/features/review/questions/ChoiceGrid';
import { introduceWord, markWordKnown, pendingWordsToLearn } from '@/features/vocab/repository';
import { WordIntroCard } from '@/features/vocab/WordIntroCard';
import { wordFromHskRecord } from '@/features/vocab/wordFactory';
import { toDayKey } from '@/lib/dayKey';
import { useNow } from '@/lib/useNow';
import { mulberry32, randomSeed, shuffle } from '@/lib/random';
import { announceActivity } from '@/progress/announce';
import { playAnswerSound } from '@/services/audio/sfx';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { PinyinText } from '@/ui/PinyinText';
import { pickLearnCandidates, type LearnCandidate } from './learnQueue';

const TRACKS: HskTrackKey[] = ['hsk3', 'hsk3-newest', 'hsk2'];
const PACES = [3, 5, 8, 10];

function Onboarding({ settings }: { settings: Settings }) {
  const [track, setTrack] = useState<HskTrackKey>(settings.hskTrack);
  const [level, setLevel] = useState(settings.currentLevel);
  const [pace, setPace] = useState(settings.newWordsPerDay);
  const maxLevel = MAX_LEVEL[track];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Học từ mới" subtitle="Chọn bộ từ và nhịp độ. Bạn có thể đổi lại trong Cài đặt bất cứ lúc nào." />
      <Card title="1. Bộ từ vựng">
        <div className="flex flex-wrap gap-2">
          {TRACKS.map((item) => (
            <Button
              key={item}
              variant={track === item ? 'primary' : 'outline'}
              onClick={() => {
                setTrack(item);
                setLevel((current) => Math.min(current, MAX_LEVEL[item]));
              }}
            >
              {TRACK_LABELS[item]}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm text-sub">HSK 3.0 là chuẩn mới (9 bậc); HSK 2.0 là bộ 6 cấp có nhiều giáo trình nhất.</p>
      </Card>
      <Card title="2. Bắt đầu từ cấp">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxLevel }, (_, index) => index + 1).map((item) => (
            <Button key={item} variant={level === item ? 'primary' : 'outline'} size="sm" onClick={() => setLevel(item)}>
              {levelLabel(item)}
            </Button>
          ))}
        </div>
      </Card>
      <Card title="3. Số từ mới mỗi ngày">
        <div className="flex flex-wrap gap-2">
          {PACES.map((item) => (
            <Button key={item} variant={pace === item ? 'primary' : 'outline'} size="sm" onClick={() => setPace(item)}>
              {item} từ
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm text-sub">Người mới bắt đầu: 5 từ/ngày trong 2 tuần đầu, sau đó tăng lên 8.</p>
      </Card>
      <Button
        size="lg"
        onClick={() => void updateSettings({ hskTrack: track, currentLevel: level, newWordsPerDay: pace, onboardingDone: true })}
      >
        Bắt đầu học
      </Button>
    </div>
  );
}

interface CheckState {
  options: ChoiceOption[];
  answerId: string;
  startedAt: number;
  selectedId?: string;
}

function LearnSession({ settings }: { settings: Settings }) {
  const [rng] = useState(() => mulberry32(randomSeed()));
  const [extraToday, setExtraToday] = useState(0);
  const [queue, setQueue] = useState<LearnCandidate[] | null>(null);
  const [pool, setPool] = useState<DistractorCandidate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState<Word | null>(null);
  const [check, setCheck] = useState<CheckState | null>(null);
  const [learnedNow, setLearnedNow] = useState<Word[]>([]);
  /** True while the answer is being written; leaving the word before that would lose it. */
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const now = useNow(60_000);

  const introducedToday = useLiveQuery(
    async () => (await db.dailyStats.get(toDayKey(now, settings.dayStartHour)))?.newIntroduced ?? 0,
    [settings.dayStartHour, now],
  );
  const remaining = introducedToday === undefined ? null : remainingNewWords(settings.newWordsPerDay, introducedToday, extraToday);

  // Load candidates once per visit (and again after "learn more").
  useEffect(() => {
    let active = true;
    Promise.all([pendingWordsToLearn(), loadHskUpTo(settings.hskTrack, settings.currentLevel), db.words.toArray()])
      .then(([pending, records, words]: [Word[], HskWordRecord[], Word[]]) => {
        if (!active) return;
        const existing = new Set(words.map((word) => wordKey(word.simplified, word.pinyinNum)));
        setPool(buildCandidatePool(words, records, settings.hskTrack));
        setQueue(pickLearnCandidates(pending, records, existing, settings.newWordsPerDay + extraToday + 20));
        setIndex(0);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [settings.hskTrack, settings.currentLevel, settings.newWordsPerDay, extraToday]);

  const candidate = queue?.[index];
  const candidateWord = useCallback(
    (item: LearnCandidate): Word => (item.kind === 'saved' ? item.word : wordFromHskRecord(item.record, Date.now())),
    [],
  );

  // Materialise the Word for the current candidate (a fresh id for HSK records).
  useEffect(() => {
    if (!candidate) return;
    queueMicrotask(() => {
      setCurrent(candidateWord(candidate));
      setCheck(null);
    });
  }, [candidate, candidateWord]);

  const startCheck = () => {
    if (!current) return;
    const target = wordToCandidate(current, settings.hskTrack);
    const distractors = meaningDistractors(target, pool, 3, rng);
    const options = shuffle(
      [target, ...distractors].map((item) => ({ id: item.id, label: item.meaningVi[0] ?? '' })),
      rng,
    );
    setCheck({ options, answerId: target.id, startedAt: performance.now() });
  };

  const answer = async (selectedId: string) => {
    if (!current || !check || check.selectedId || busy.current) return;
    busy.current = true;
    setSaving(true);
    const correct = selectedId === check.answerId;
    setCheck({ ...check, selectedId });
    playAnswerSound(correct);
    try {
      const { word } = await introduceWord(current);
      const result = await answerCard({
        cardId: `read:${word.id}`,
        mode: 'learn',
        signal: { questionType: 'learn-intro', correct, elapsedMs: performance.now() - check.startedAt },
      });
      if (result.activity) announceActivity({ ...result.activity, newBadges: result.newBadges }, `Học từ ${word.simplified}`);
      setLearnedNow((list) => [...list, word]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được từ.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const next = () => {
    // The previous word's write may still be running; it must not block the next answer.
    busy.current = false;
    setCheck(null);
    setCurrent(null);
    setIndex((value) => value + 1);
  };

  const skipKnown = async () => {
    if (!current || busy.current) return;
    busy.current = true;
    try {
      await markWordKnown(current);
      toast(`Đã đánh dấu “${current.simplified}” là từ đã biết.`);
      next();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được.');
    } finally {
      busy.current = false;
    }
  };

  // Keyboard: 1–4 answer, Enter continues.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.isComposing) return;
      if (check && !check.selectedId && /^[1-4]$/.test(event.key)) {
        const option = check.options[Number(event.key) - 1];
        if (option) void answer(option.id);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (check?.selectedId) {
          if (!saving) next();
        } else if (current && !check) startCheck();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const header = <PageHeader title="Học từ mới" subtitle={`${TRACK_LABELS[settings.hskTrack]} · ${levelLabel(settings.currentLevel)} · ${settings.newWordsPerDay} từ/ngày`} />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Card title="Chưa tải được danh sách từ">
          <p className="text-sm text-danger">{loadError}</p>
        </Card>
      </div>
    );
  }

  const finishedToday = remaining !== null && remaining <= 0 && !check?.selectedId;
  if (finishedToday || (queue && index >= queue.length)) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Card>
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
            <h2 className="mt-3 text-2xl font-bold text-fg">{queue && index >= queue.length && !finishedToday ? 'Đã hết từ trong cấp này' : 'Xong phần từ mới hôm nay'}</h2>
            <p className="mt-2 text-sub">
              Hôm nay bạn đã học <strong className="text-fg">{introducedToday ?? 0}</strong> từ mới
              {learnedNow.length > 0 && (
                <>
                  : <span className="font-hanzi text-fg">{learnedNow.map((word) => word.simplified).join('、')}</span>
                </>
              )}
              .
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/review" className="inline-flex h-10 items-center rounded-full bg-linear-to-r from-primary to-primary-end px-5 text-sm font-medium text-white">
                Ôn tập ngay
              </Link>
              <Button variant="outline" onClick={() => setExtraToday((value) => value + 5)}>
                Học thêm 5 từ
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!queue || !current || remaining === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <p className="text-sub">Đang chuẩn bị từ mới…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {header}
      <div className="flex items-center justify-between text-sm text-sub">
        <span data-testid="learn-remaining">Còn {remaining} từ mới hôm nay</span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="size-4 text-primary" aria-hidden /> {current.source === 'hsk-list' ? 'Từ HSK' : 'Từ bạn đã lưu'}
        </span>
      </div>

      <Card>
        {!check ? (
          <WordIntroCard
            word={current}
            autoPlay
            actions={
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <Button variant="ghost" onClick={() => void skipKnown()}>
                  Tôi đã biết từ này
                </Button>
                <Button onClick={startCheck}>Kiểm tra nhanh</Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-5" data-word-id={current.id}>
            <div className="text-center">
              <p className="text-sm text-sub">Từ này nghĩa là gì?</p>
              <p className="font-hanzi mt-2 text-6xl text-fg">{current.simplified}</p>
              <PinyinText pinyin={current.pinyinNum} className="mt-2 block text-xl" />
            </div>
            <ChoiceGrid options={check.options} answerId={check.answerId} selectedId={check.selectedId} onSelect={(id) => void answer(id)} />
            {check.selectedId && (
              <div
                role="status"
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${
                  check.selectedId === check.answerId ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                }`}
              >
                <span className="font-semibold">
                  {check.selectedId === check.answerId ? 'Chính xác! Từ này sẽ quay lại sau 20 phút.' : `Chưa đúng — “${current.meaningVi[0]}”. Sẽ ôn lại sớm.`}
                </span>
                <Button onClick={next} disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Từ tiếp theo'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export function LearnPage() {
  const settings = useLoadedSettings();
  if (!settings) return <p className="text-sub">Đang tải…</p>;
  return settings.onboardingDone ? <LearnSession settings={settings} /> : <Onboarding settings={settings} />;
}
