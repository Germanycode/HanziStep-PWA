import { ArrowLeft, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { comparePinyin, type PinyinComparison } from '@/chinese/pinyin/compare';
import { toMarks } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { loadSyllableTable, type SyllableTable } from '@/data/syllables';
import { mulberry32, randomSeed, type Rng } from '@/lib/random';
import { announceActivity } from '@/progress/announce';
import { recordActivity } from '@/progress/recordActivity';
import { stopClip } from '@/services/audio/clips';
import { playSyllableSequence } from '@/services/audio/sequence';
import { playAnswerSound } from '@/services/audio/sfx';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import { buildRound, ROUND_SIZE, roundXp } from './drillEngine';
import { drillItemKeys, findDrill, makeQuestion, type DrillDefinition, type DrillQuestion, type DrillType } from './drills';
import { getDrillStats, saveDrillAnswer } from './store';

interface AnswerState {
  correct: boolean;
  choiceId?: string;
  comparison?: PinyinComparison;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface PreparedRound {
  table: SyllableTable;
  round: string[];
  first: DrillQuestion;
}

/** Loads recordings and stats, then picks this round's items (weighted by past mistakes). */
async function prepareRound(type: DrillType, rng: Rng): Promise<PreparedRound> {
  const [table, stats] = await Promise.all([loadSyllableTable(), getDrillStats()]);
  const round = buildRound(drillItemKeys(type, table), stats, ROUND_SIZE, rng);
  const firstKey = round[0];
  if (!firstKey) throw new Error('Chưa có bản ghi âm cho bài luyện này.');
  return { table, round, first: makeQuestion(type, firstKey, table, rng) };
}

function DrillRunner({ drill }: { drill: DrillDefinition }) {
  const [rng] = useState(() => mulberry32(randomSeed()));
  const [table, setTable] = useState<SyllableTable | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [round, setRound] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [typed, setTyped] = useState('');
  const [summary, setSummary] = useState<{ correct: number; total: number; xp: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const finishingRef = useRef(false);
  const pendingWritesRef = useRef<Promise<void>>(Promise.resolve());

  const playPrompt = useCallback(async (current: DrillQuestion, slow = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await playSyllableSequence(current.prompt, {
        rate: slow ? 0.75 : 1,
        gapMs: current.prompt.length > 1 ? 250 : 0,
        signal: controller.signal,
      });
    } catch (error) {
      if (!controller.signal.aborted) toast.error(`Không phát được âm thanh: ${errorText(error)}`);
    }
  }, []);

  const applyRound = useCallback(
    (prepared: PreparedRound) => {
      setTable(prepared.table);
      setRound(prepared.round);
      setIndex(0);
      setCorrectCount(0);
      setAnswer(null);
      setTyped('');
      setSummary(null);
      setFinishing(false);
      finishingRef.current = false;
      setQuestion(prepared.first);
      void playPrompt(prepared.first);
    },
    [playPrompt],
  );

  const restart = () => {
    prepareRound(drill.type, rng).then(applyRound, (error: unknown) => setLoadError(errorText(error)));
  };

  useEffect(() => {
    let active = true;
    prepareRound(drill.type, rng).then(
      (prepared) => {
        if (active) applyRound(prepared);
      },
      (error: unknown) => {
        if (active) setLoadError(errorText(error));
      },
    );
    return () => {
      active = false;
      abortRef.current?.abort();
      stopClip();
    };
  }, [drill.type, rng, applyRound]);

  const submit = (result: AnswerState) => {
    if (!question || answer || finishingRef.current) return;
    setAnswer(result);
    if (result.correct) setCorrectCount((count) => count + 1);
    playAnswerSound(result.correct);
    pendingWritesRef.current = pendingWritesRef.current
      .then(() => saveDrillAnswer(question.key, result.correct, question.isToneQuestion))
      .catch((error: unknown) => {
        toast.error(`Không lưu được kết quả: ${errorText(error)}`);
      });
  };

  const choose = (optionId: string) => submit({ correct: optionId === question?.answerId, choiceId: optionId });

  const checkTyped = () => {
    if (!question?.expected || answer || !typed.trim()) return;
    const { syllables, errors } = parsePinyin(typed);
    const comparison = comparePinyin([question.expected], syllables);
    submit({ correct: errors.length === 0 && comparison.ok, comparison });
  };

  const next = async () => {
    if (!answer || !table) return;
    const nextIndex = index + 1;
    const nextKey = round[nextIndex];
    if (!nextKey) {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);
      abortRef.current?.abort();
      try {
        await pendingWritesRef.current;
        const result = await recordActivity({
          kind: 'drill-round',
          amount: roundXp(correctCount, round.length),
          counters: { drillItems: round.length },
        });
        announceActivity(result, drill.title);
        setSummary({ correct: correctCount, total: round.length, xp: result.xpAwarded });
      } catch (error) {
        toast.error(`Không lưu được tiến độ: ${errorText(error)}`);
        setSummary({ correct: correctCount, total: round.length, xp: 0 });
      }
      return;
    }
    const nextQuestion = makeQuestion(drill.type, nextKey, table, rng);
    setIndex(nextIndex);
    setQuestion(nextQuestion);
    setAnswer(null);
    setTyped('');
    void playPrompt(nextQuestion);
  };

  // Keyboard: 1–4 choose, Space replays (Shift = slow), Enter continues. Re-bound every render to see fresh state.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!question || summary || event.isComposing) return;
      // Text inputs handle their own keys. Without this, the Enter that submits a typed answer
      // would reach this listener after React re-rendered with the answer set, and skip the feedback.
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'Enter' && answer) {
        event.preventDefault();
        void next();
      } else if (event.key === ' ') {
        event.preventDefault();
        void playPrompt(question, event.shiftKey);
      } else if (!answer && /^[1-4]$/.test(event.key)) {
        const option = question.options[Number(event.key) - 1];
        if (option) choose(option.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const header = (
    <>
      <Link to="/pinyin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Phát âm
      </Link>
      <PageHeader title={drill.title} subtitle={drill.description} />
    </>
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <Card title="Chưa luyện được">
          <p className="text-sm text-danger">{loadError}</p>
        </Card>
      </div>
    );
  }

  if (summary) {
    const accuracy = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <Card>
          <div className="py-6 text-center">
            <h2 className="text-2xl font-bold text-fg">Hoàn thành vòng luyện</h2>
            <p className="mt-4 text-5xl font-bold text-primary" data-testid="drill-score">
              {summary.correct}/{summary.total}
            </p>
            <p className="mt-2 text-sub">
              Chính xác {accuracy}% · {summary.xp > 0 ? `+${summary.xp} XP` : 'Đã đạt giới hạn XP hôm nay'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={restart}>Luyện vòng mới</Button>
              <Link to="/pinyin" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-fg hover:bg-surface-2">
                Về trang Phát âm
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <p className="text-sub">Đang chuẩn bị câu hỏi…</p>
      </div>
    );
  }

  const revealed = toMarks(question.prompt);
  const isLast = index + 1 >= round.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {header}
      <Card>
        <div className="flex items-center justify-between text-sm text-sub">
          <span data-testid="drill-counter">
            Câu {index + 1}/{round.length}
          </span>
          <span>Đúng {correctCount}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${(index / round.length) * 100}%` }} />
        </div>

        <div className="my-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void playPrompt(question)}
            aria-label="Nghe lại"
            className="grid size-24 place-items-center rounded-full bg-linear-to-r from-primary to-primary-end text-white shadow-lg transition hover:brightness-110"
          >
            <Volume2 className="size-10" aria-hidden />
          </button>
          <button type="button" onClick={() => void playPrompt(question, true)} className="text-sm text-sub hover:text-fg">
            Nghe chậm · phím Space để nghe lại
          </button>
        </div>

        {question.options.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              let tone = 'border-line hover:border-line-hover hover:bg-surface-2';
              if (answer) {
                if (option.id === question.answerId) tone = 'border-success bg-success/15';
                else if (option.id === answer.choiceId) tone = 'border-danger bg-danger/15';
                else tone = 'border-line opacity-60';
              }
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(answer)}
                  onClick={() => choose(option.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-lg font-medium text-fg transition ${tone}`}
                >
                  <kbd className="rounded bg-surface-2 px-1.5 text-xs text-muted">{optionIndex + 1}</kbd>
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex gap-2">
            <TextInput
              aria-label="Pinyin bạn nghe được"
              placeholder="Ví dụ: ma3 hoặc mǎ"
              value={typed}
              disabled={Boolean(answer)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing || answer) return;
                event.preventDefault();
                event.stopPropagation();
                checkTyped();
              }}
            />
            <Button onClick={checkTyped} disabled={Boolean(answer) || !typed.trim()}>
              Kiểm tra
            </Button>
          </div>
        )}

        {answer && (
          <div
            role="status"
            className={`mt-6 rounded-xl p-4 ${answer.correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
          >
            <p className="font-semibold">
              {answer.correct
                ? 'Chính xác!'
                : answer.comparison && answer.comparison.segmentErrors.length === 0 && answer.comparison.toneErrors.length > 0
                  ? 'Đúng âm tiết nhưng sai thanh.'
                  : 'Chưa đúng.'}
            </p>
            <p className="mt-1 text-fg">
              Âm vừa nghe: <span className="font-semibold">{revealed}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={() => void next()} disabled={finishing}>
                {finishing ? 'Đang lưu…' : isLast ? 'Xem kết quả' : 'Tiếp theo'}
              </Button>
              <Button variant="outline" onClick={() => void playPrompt(question)}>
                Nghe lại
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function DrillPage() {
  const { drillType = '' } = useParams();
  const drill = findDrill(drillType);
  if (!drill) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Không tìm thấy bài luyện" />
        <Link to="/pinyin" className="text-primary hover:underline">
          Về trang Phát âm
        </Link>
      </div>
    );
  }
  return <DrillRunner key={drill.type} drill={drill} />;
}
