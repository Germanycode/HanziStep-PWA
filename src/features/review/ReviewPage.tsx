import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AnswerSignal } from '@/features/review/engine/quality';
import { mulberry32, randomSeed, shuffle } from '@/lib/random';
import { announceActivity } from '@/progress/announce';
import { stopClip } from '@/services/audio/clips';
import { playAnswerSound } from '@/services/audio/sfx';
import { stopSpeaking } from '@/services/speech/tts';
import { useWordSpeaker } from '@/services/speech/wordSpeaker';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { answerCard, completeSession, type AnswerCardResult } from './engine/answerCard';
import type { Question } from './engine/questions';
import { matchBonusItems, type SessionItem } from './engine/session';
import { AnswerFeedback } from './AnswerFeedback';
import { QuestionView } from './questions/QuestionView';
import { ReviewGate } from './ReviewGate';
import { loadSessionContext, prepareQuestion, type SessionContext } from './session/resources';
import type { AnswerOutcome } from './session/types';
import { loadReviewSnapshot, useReviewSnapshot } from './session/useReviewSnapshot';
import { SessionBar } from './SessionBar';
import { SessionDone } from './SessionDone';

type Phase = 'loading' | 'question' | 'feedback' | 'break' | 'done' | 'error';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface SessionProps {
  tag?: string;
  shuffleOrder: boolean;
  onExit: () => void;
}

function ReviewSession({ tag, shuffleOrder, onExit }: SessionProps) {
  const [rng] = useState(() => mulberry32(randomSeed()));
  const { sayWord, saySentence } = useWordSpeaker();
  const [context, setContext] = useState<SessionContext | null>(null);
  const [queue, setQueue] = useState<SessionItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [result, setResult] = useState<AnswerCardResult | null>(null);
  /** Set when the answer could not be written, so the session is not stuck on "saving". */
  const [saveFailed, setSaveFailed] = useState(false);
  const [stats, setStats] = useState({ answers: 0, correct: 0, xp: 0 });
  const [wrong, setWrong] = useState<SessionItem[]>([]);
  const [mode, setMode] = useState<'review' | 'retry'>('review');
  const [hints, setHints] = useState(0);
  const [replays, setReplays] = useState(0);
  const [pinyinRevealed, setPinyinRevealed] = useState(false);
  const [nextDueAt, setNextDueAt] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const promptStartRef = useRef(0);
  const audioRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const completedRef = useRef(false);
  const forceTypeRef = useRef<Question['type'] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadSessionContext(tag).then(
      ({ context: loaded, plan }) => {
        if (!active) return;
        setContext(loaded);
        setQueue(shuffleOrder ? shuffle(plan.items, rng) : plan.items);
        setNextDueAt(plan.nextDueAt);
        setPhase(plan.items.length > 0 ? 'question' : 'done');
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError(errorText(error));
        setPhase('error');
      },
    );
    return () => {
      active = false;
      audioRef.current?.abort();
      stopSpeaking();
      stopClip();
    };
  }, [tag, shuffleOrder, rng]);

  const playPrompt = useCallback(
    async (current: Question, slow = false) => {
      if (current.promptAudio === 'none') return;
      audioRef.current?.abort();
      const controller = new AbortController();
      audioRef.current = controller;
      try {
        if (current.promptAudio === 'sentence' && (current.kind === 'order' || current.kind === 'dictation')) {
          await saySentence(current.sentence.zh, slow, controller.signal);
        } else {
          await sayWord(current.word, slow, controller.signal);
        }
      } catch (error) {
        if (!controller.signal.aborted) toast.error(`Không phát được âm thanh: ${errorText(error)}`);
      }
    },
    [sayWord, saySentence],
  );

  const finish = useCallback(
    async (queueEmptied: boolean, answers: number) => {
      audioRef.current?.abort();
      setPhase('done');
      if (mode === 'review' && !completedRef.current) {
        completedRef.current = true;
        try {
          const activity = await completeSession(answers, queueEmptied);
          if (activity) announceActivity(activity, 'Hoàn thành phiên ôn');
        } catch (error) {
          toast.error(errorText(error));
        }
      }
      loadReviewSnapshot(tag).then(
        (snapshot) => setNextDueAt(snapshot.nextDueAt),
        () => {},
      );
    },
    [mode, tag],
  );

  // Builds the question for the current item (example sentences may need loading).
  useEffect(() => {
    if (!context || phase !== 'question' || question) return;
    const item = queue[index];
    if (!item) return;
    let active = true;
    prepareQuestion(item, context, queue.slice(index + 1), { retry: mode === 'retry', forceType: forceTypeRef.current }, rng).then(
      (built) => {
        if (!active) return;
        forceTypeRef.current = undefined;
        setHints(0);
        setReplays(0);
        setPinyinRevealed(false);
        setOutcome(null);
        setResult(null);
        promptStartRef.current = performance.now();
        setQuestion(built);
        // The clock starts when the prompt has been shown (or played).
        if (built.autoPlay) {
          void playPrompt(built).finally(() => {
            promptStartRef.current = performance.now();
          });
        }
      },
      (error: unknown) => {
        if (!active) return;
        toast.error(errorText(error));
        const remaining = queue.filter((other) => other.cardId !== item.cardId);
        setQueue(remaining);
        setQuestion(null);
        if (remaining.length === 0 || index >= remaining.length) void finish(true, stats.answers);
      },
    );
    return () => {
      active = false;
    };
  }, [context, phase, question, queue, index, mode, rng, playPrompt, finish, stats.answers]);

  const applyMatchBonus = async (current: Question, answer: AnswerOutcome, item: SessionItem) => {
    if (current.kind !== 'match' || mode !== 'review') return;
    const mistakes = answer.matchMistakes ?? [];
    const bonuses = matchBonusItems(
      queue,
      index,
      (answer.matchCorrect ?? []).filter((id) => id !== item.subjectId && !mistakes.includes(id)),
    );
    const penalties = matchBonusItems(
      queue,
      index,
      mistakes.filter((id) => id !== item.subjectId),
    );
    if (bonuses.length === 0 && penalties.length === 0) return;
    for (const bonus of bonuses) {
      await answerCard({ cardId: bonus.cardId, mode: 'match-bonus', signal: { questionType: 'match', correct: true, elapsedMs: 0 } });
    }
    for (const penalty of penalties) {
      await answerCard({ cardId: penalty.cardId, mode: 'match-bonus', signal: { questionType: 'match', correct: false, elapsedMs: 0 } });
    }
    const handled = new Set([...bonuses, ...penalties].map((entry) => entry.cardId));
    setQueue((list) => list.filter((entry, position) => position <= index || !handled.has(entry.cardId)));
    if (bonuses.length > 0) toast(`Nối cặp: ${bonuses.length} thẻ khác cũng được tính là đã ôn.`);
  };

  const handleAnswer = async (answer: AnswerOutcome) => {
    const current = question;
    const item = queue[index];
    if (!current || !item || outcome || busyRef.current) return;
    busyRef.current = true;
    setOutcome(answer);
    setPhase('feedback');
    playAnswerSound(answer.correct);
    audioRef.current?.abort();
    try {
      const signal: AnswerSignal = {
        questionType: current.type,
        correct: answer.correct,
        elapsedMs: performance.now() - promptStartRef.current,
        hints,
        replays,
        pinyinRevealed,
        ...answer.signal,
      };
      const answered = await answerCard({ cardId: item.cardId, mode: mode === 'retry' ? 'retry' : 'review', signal });
      setResult(answered);
      if (answered.activity) {
        announceActivity({ ...answered.activity, newBadges: answered.newBadges }, 'Ôn tập', { xpToast: false });
      }
      const gained = answered.activity ? answered.activity.xpAwarded + (answered.activity.goalReachedNow ? answered.activity.goalBonus : 0) : 0;
      setStats((previous) => ({
        answers: previous.answers + 1,
        correct: previous.correct + (answer.correct ? 1 : 0),
        xp: previous.xp + gained,
      }));
      if (!answer.correct && mode === 'review') {
        setWrong((list) => (list.some((entry) => entry.cardId === item.cardId) ? list : [...list, item]));
      }
      await applyMatchBonus(current, answer, item);
    } catch (error) {
      setSaveFailed(true);
      toast.error(errorText(error));
    } finally {
      busyRef.current = false;
    }
  };

  const next = () => {
    // A slow write for the previous card must not swallow the next answer.
    busyRef.current = false;
    setQuestion(null);
    setOutcome(null);
    setResult(null);
    setSaveFailed(false);
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      void finish(true, stats.answers);
      return;
    }
    setIndex(nextIndex);
    const size = context?.settings.sessionSize ?? 25;
    setPhase(stats.answers > 0 && stats.answers % size === 0 ? 'break' : 'question');
  };

  const startRetry = () => {
    setMode('retry');
    setQueue(wrong);
    setWrong([]);
    setIndex(0);
    setQuestion(null);
    setOutcome(null);
    setResult(null);
    setPhase('question');
  };

  // Space replays, H asks for a hint, P shows the pinyin, Enter continues.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === ' ' && question && question.promptAudio !== 'none') {
        event.preventDefault();
        if (phase === 'question') setReplays((count) => count + 1);
        void playPrompt(question, event.shiftKey);
        return;
      }
      if (phase === 'feedback' && event.key === 'Enter') {
        event.preventDefault();
        // Wait for the answer to be written, or the schedule change would be lost.
        if (result || saveFailed) next();
        return;
      }
      if (phase !== 'question' || !question) return;
      if ((event.key === 'h' || event.key === 'H') && (question.kind === 'pinyin' || question.kind === 'ime-cloze')) {
        event.preventDefault();
        setHints((count) => count + 1);
      } else if ((event.key === 'p' || event.key === 'P') && question.canRevealPinyin) {
        event.preventDefault();
        setPinyinRevealed(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const header = <PageHeader title={mode === 'retry' ? 'Ôn lại câu sai' : 'Ôn tập'} />;

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Card title="Không mở được phiên ôn">
          <p className="text-sm text-danger">{loadError}</p>
          <Button className="mt-4" variant="outline" onClick={onExit}>
            Quay lại
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <SessionDone
          answers={stats.answers}
          correct={stats.correct}
          xp={stats.xp}
          startedAt={startedAt}
          wrongCount={wrong.length}
          nextDueAt={nextDueAt}
          onRetry={startRetry}
          onContinue={onExit}
        />
      </div>
    );
  }

  if (phase === 'break') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Card>
          <div className="py-6 text-center">
            <h2 className="text-xl font-semibold text-fg">Nghỉ một chút</h2>
            <p className="mt-2 text-sub">
              Đã ôn {stats.answers} câu, đúng {stats.correct}. Còn {queue.length - index} thẻ.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button onClick={() => setPhase('question')}>Tiếp tục</Button>
              <Button variant="outline" onClick={() => void finish(false, stats.answers)}>
                Dừng ở đây
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <p className="text-sub">Đang chuẩn bị câu hỏi…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {header}
      <Card>
        <SessionBar
          index={index}
          total={queue.length}
          correct={stats.correct}
          answers={stats.answers}
          startedAt={startedAt}
          retry={mode === 'retry'}
          onStop={() => void finish(false, stats.answers)}
        />
        <div className="mt-6" data-word-id={question.word.id} data-question-type={question.type}>
          <QuestionView
            question={question}
            answered={outcome}
            hints={hints}
            pinyinRevealed={pinyinRevealed}
            onHint={() => setHints((count) => count + 1)}
            onAnswer={(value) => void handleAnswer(value)}
            onPlayPrompt={(slow) => {
              if (phase === 'question') setReplays((count) => count + 1);
              void playPrompt(question, slow);
            }}
            onFallback={() => {
              forceTypeRef.current = 'pinyin-typing';
              setQuestion(null);
            }}
          />
        </div>
        {outcome && (
          <AnswerFeedback
            question={question}
            outcome={outcome}
            result={result}
            mode={mode}
            isLast={index + 1 >= queue.length}
            saving={!result && !saveFailed}
            onNext={next}
            onPlayWord={() => sayWord(question.word)}
          />
        )}
      </Card>
    </div>
  );
}

export function ReviewPage() {
  const [tag, setTag] = useState('');
  const [shuffleOrder, setShuffleOrder] = useState(false);
  const [runId, setRunId] = useState(0);
  const snapshot = useReviewSnapshot(tag || undefined);

  if (runId > 0) {
    return <ReviewSession key={runId} tag={tag || undefined} shuffleOrder={shuffleOrder} onExit={() => setRunId(0)} />;
  }
  return (
    <ReviewGate
      snapshot={snapshot}
      tag={tag}
      onTagChange={setTag}
      shuffleOrder={shuffleOrder}
      onShuffleChange={setShuffleOrder}
      onStart={() => setRunId((id) => id + 1)}
    />
  );
}
