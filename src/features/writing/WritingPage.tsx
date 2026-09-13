import { useLiveQuery } from 'dexie-react-hooks';
import { Lightbulb, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { db } from '@/db/db';
import { answerCard } from '@/features/review/engine/answerCard';
import { announceActivity } from '@/progress/announce';
import { isDue } from '@/srs/cards';
import { Button } from '@/ui/Button';
import { Card as Panel } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { PinyinText } from '@/ui/PinyinText';
import { HanziCanvas } from './HanziCanvas';
import { syncWritingCharacters } from './repository';
import { useSettings } from '@/db/settings';

export function WritingPage() {
  const settings = useSettings();
  const [openedAt] = useState(() => Date.now());
  useEffect(() => {
    if (settings.enabledFacets.includes('write')) void syncWritingCharacters();
  }, [settings.enabledFacets]);
  const data = useLiveQuery(async () => {
    const [chars, cards, words] = await Promise.all([
      db.chars.toArray(),
      db.cards.where('facet').equals('write').toArray(),
      db.words.toArray(),
    ]);
    return { chars, cards, words };
  }, []);
  const due = useMemo(() => {
    if (!data) return [];
    const chars = new Map(data.chars.map((char) => [char.id, char]));
    return data.cards.filter((card) => isDue(card, openedAt)).sort((a, b) => a.due - b.due).flatMap((card) => {
      const char = chars.get(card.subjectId);
      return char ? [{ card, char }] : [];
    });
  }, [data, openedAt]);
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [hint, setHint] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const mistakes = useRef(0);
  const ids = useMemo(() => sessionIds ?? [], [sessionIds]);
  const current = useMemo(() => {
    const id = ids[position];
    if (!id || !data) return undefined;
    const card = data.cards.find((item) => item.id === id);
    const char = card && data.chars.find((item) => item.id === card.subjectId);
    const sourceWords = char ? data.words.filter((word) => char.wordIds.includes(word.id)) : [];
    return card && char ? { card, char, sourceWords } : undefined;
  }, [data, ids, position]);

  const resetQuestion = () => {
    setQuizStarted(false);
    setHint(false);
    setRestartToken(0);
    setStartedAt(Date.now());
    mistakes.current = 0;
  };
  const advance = () => {
    setPosition((value) => value + 1);
    resetQuestion();
  };
  const grade = async (correct: boolean) => {
    if (!current) return;
    try {
      const result = await answerCard({
        cardId: current.card.id,
        mode: 'review',
        signal: {
          questionType: 'stroke-quiz',
          correct,
          elapsedMs: Date.now() - startedAt,
          attempts: mistakes.current,
          hints: hint ? 1 : 0,
        },
      });
      if (result.activity) announceActivity({ ...result.activity, newBadges: result.newBadges }, `Viết chữ ${current.char.character}`);
      toast(correct ? `Đúng thứ tự nét · chất lượng ${result.quality}` : 'Đã ghi nhận để ôn lại.');
      advance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được kết quả.');
    }
  };

  if (!data) return <p className="p-6 text-sub">Đang tải…</p>;
  if (!settings.enabledFacets.includes('write')) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Tập viết" subtitle="Viết theo đúng thứ tự nét" />
        <Panel><p className="text-sub">Hãy bật facet “Viết theo nét” trong Cài đặt → Học tập để bắt đầu.</p></Panel>
      </div>
    );
  }
  if (sessionIds === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Tập viết" subtitle="Viết theo đúng thứ tự nét" />
        <Panel className="space-y-4">
          <p className="text-sub">{due.length > 0 ? `${due.length} chữ đang chờ luyện.` : 'Chưa có chữ đến hạn. Chữ mới mở khi một từ chứa nó đạt mức Nhớ (3 lần ôn đúng).'}</p>
          {due.length > 0 && <Button onClick={() => { setSessionIds(due.map((item) => item.card.id)); setStartedAt(Date.now()); }}>Bắt đầu</Button>}
        </Panel>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Hoàn thành buổi tập viết" subtitle={`Đã xử lý ${ids.length} chữ`} />
        <Panel><Button onClick={() => { setSessionIds(null); setPosition(0); resetQuestion(); }}>Kiểm tra chữ đến hạn</Button></Panel>
      </div>
    );
  }

  const repetition = current.card.repetition;
  const animationFirst = repetition === 0 && !quizStarted;
  const sourceWord = current.sourceWords[0];
  const directMeaning = current.char.meaningsVi.slice(0, 2).join('; ');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tập viết" subtitle={`Chữ ${position + 1}/${ids.length} · lần ôn ${repetition + 1}`} />
      <Panel className="space-y-4">
        <div className="text-center">
          {repetition >= 3 && !animationFirst ? (
            <>
              <p className="text-lg text-fg">
                {directMeaning || (current.char.hanViet.length > 0 ? `Viết chữ Hán-Việt ${current.char.hanViet.join(' / ')}` : 'Viết chữ tương ứng')}
              </p>
              {current.char.pinyin.length > 0 && <PinyinText pinyin={current.char.pinyin.join(' / ')} className="text-base" />}
              {!directMeaning && sourceWord && (
                <p className="text-sm text-sub">
                  Gợi từ: <span className="font-hanzi text-fg">{sourceWord.simplified}</span>
                  {sourceWord.meaningVi.length > 0 ? ` — ${sourceWord.meaningVi.slice(0, 2).join('; ')}` : ''}
                </p>
              )}
            </>
          ) : <p className="text-sm text-sub">{animationFirst ? 'Quan sát thứ tự nét, rồi tự viết lại.' : 'Vẽ từng nét bằng chuột hoặc ngón tay.'}</p>}
        </div>
        <HanziCanvas
          character={current.char.character}
          mode={animationFirst ? 'animate' : 'quiz'}
          showOutline={repetition <= 1}
          hintRequested={hint}
          restartToken={restartToken}
          onMistake={() => { mistakes.current += 1; }}
          onComplete={() => void grade(true)}
        />
        <div className="flex flex-wrap justify-center gap-2">
          {animationFirst ? (
            <Button onClick={() => { setQuizStarted(true); setStartedAt(Date.now()); }}><Play className="size-4" /> Bắt đầu tô</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setHint(true)} disabled={hint}><Lightbulb className="size-4" /> Gợi ý</Button>
              <Button variant="ghost" onClick={() => setRestartToken((value) => value + 1)}><RotateCcw className="size-4" /> Làm lại</Button>
              <Button variant="danger" onClick={() => void grade(false)}>Bỏ cuộc</Button>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
