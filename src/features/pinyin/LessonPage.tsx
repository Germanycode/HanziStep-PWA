import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { announceActivity } from '@/progress/announce';
import { useSpeaker } from '@/services/speech/useSpeaker';
import { AudioButton } from '@/ui/AudioButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { PinyinText } from '@/ui/PinyinText';
import { LESSONS, type LessonExample } from './lessons';
import { completeLesson, usePinyinProgress } from './store';

function ExampleCard({ example }: { example: LessonExample }) {
  const say = useSpeaker();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
      <AudioButton
        label={`Nghe ${example.hanzi ?? example.pinyin}`}
        onPlay={() => say({ pinyin: example.spoken ?? example.pinyin, hanzi: example.hanzi })}
        className="size-10 shrink-0 bg-primary/10 text-primary"
      />
      {example.hanzi && <span className="font-hanzi text-3xl text-fg">{example.hanzi}</span>}
      <span className="min-w-0">
        <PinyinText pinyin={example.pinyin} className="block text-lg font-semibold" />
        {example.spoken && (
          <span className="block text-xs text-sub">
            đọc: <PinyinText pinyin={example.spoken} />
          </span>
        )}
        {example.meaning && <span className="block text-sm text-sub">{example.meaning}</span>}
      </span>
    </div>
  );
}

export function LessonPage() {
  const { lessonId } = useParams();
  const progress = usePinyinProgress();
  const [saving, setSaving] = useState(false);
  const [checkpointState, setCheckpointState] = useState({ lessonId: '', choice: '', passed: false });
  const index = LESSONS.findIndex((lesson) => lesson.id === lessonId);
  const lesson = LESSONS[index];
  const checkpointChoice = checkpointState.lessonId === lessonId ? checkpointState.choice : '';
  const checkpointPassed = checkpointState.lessonId === lessonId && checkpointState.passed;

  if (!lesson) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Không tìm thấy bài học" />
        <Link to="/pinyin" className="text-primary hover:underline">
          Về trang Phát âm
        </Link>
      </div>
    );
  }

  if (!progress) return <p className="p-6 text-sub">Đang tải tiến độ…</p>;

  const previousLesson = LESSONS[index - 1];
  if (previousLesson && !progress.completedLessons.includes(previousLesson.id)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/pinyin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Phát âm
        </Link>
        <PageHeader title={`Bài ${index + 1} chưa mở`} subtitle="Hoàn thành checkpoint của bài trước để học theo đúng thứ tự." />
        <Card>
          <Link to={`/pinyin/lessons/${previousLesson.id}`} className="text-primary hover:underline">
            Học bài trước: {previousLesson.title}
          </Link>
        </Card>
      </div>
    );
  }

  const done = progress.completedLessons.includes(lesson.id);
  const nextLesson = LESSONS[index + 1];
  const checkpointExamples = lesson.sections.flatMap((section) => section.examples ?? []).filter((example) => example.hanzi);
  const checkpoint = checkpointExamples[0];
  const rawOptions = [...new Set(checkpointExamples.map((example) => example.pinyin))].slice(0, 4);
  const offset = rawOptions.length > 0 ? index % rawOptions.length : 0;
  const checkpointOptions = [...rawOptions.slice(offset), ...rawOptions.slice(0, offset)];

  const handleComplete = async () => {
    setSaving(true);
    try {
      const result = await completeLesson(lesson.id);
      if (result) announceActivity(result, `Hoàn thành bài ${index + 1}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được tiến độ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/pinyin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Phát âm
      </Link>
      <PageHeader title={`Bài ${index + 1}: ${lesson.title}`} subtitle={lesson.summary} />

      {lesson.sections.map((section) => (
        <Card key={section.heading} title={section.heading}>
          <div className="space-y-3 text-sm leading-relaxed text-fg">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {section.table && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted uppercase">
                  <tr>
                    {section.table.head.map((cell) => (
                      <th key={cell} className="py-2 pr-4">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {section.table.rows.map((row) => (
                    <tr key={row.join('|')}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className={`py-2 pr-4 ${cellIndex === 0 ? 'font-semibold text-fg' : 'text-sub'}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.examples && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {section.examples.map((example) => (
                <ExampleCard key={`${example.pinyin}-${example.hanzi ?? ''}`} example={example} />
              ))}
            </div>
          )}
        </Card>
      ))}

      {!done && checkpoint && (
        <Card title="Kiểm tra nhanh" description="Chọn đúng một câu để xác nhận bạn đã nắm nội dung chính trước khi sang bài tiếp theo.">
          <p className="text-sm text-sub">
            Pinyin đúng của <span className="font-hanzi mx-1 text-2xl text-fg">{checkpoint.hanzi}</span>
            {checkpoint.meaning ? ` (${checkpoint.meaning})` : ''} là gì?
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {checkpointOptions.map((option) => (
              <Button
                key={option}
                variant={checkpointChoice === option ? 'primary' : 'outline'}
                aria-label={`Chọn ${option}`}
                aria-pressed={checkpointChoice === option}
                onClick={() => {
                  setCheckpointState({ lessonId: lesson.id, choice: option, passed: option === checkpoint.pinyin });
                }}
              >
                <PinyinText pinyin={option} />
              </Button>
            ))}
          </div>
          {checkpointChoice && (
            <p role="status" className={`mt-3 text-sm ${checkpointPassed ? 'text-success' : 'text-danger'}`}>
              {checkpointPassed ? 'Chính xác. Bạn có thể hoàn thành bài.' : 'Chưa đúng; hãy nghe lại ví dụ rồi thử lại.'}
            </p>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {done ? (
          <span className="inline-flex items-center gap-2 text-success">
            <CheckCircle2 className="size-5" aria-hidden /> Đã hoàn thành
          </span>
        ) : (
          <Button onClick={() => void handleComplete()} disabled={saving || !checkpointPassed}>
            Hoàn thành bài học
          </Button>
        )}
        {nextLesson && done ? (
          <Link to={`/pinyin/lessons/${nextLesson.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            Bài tiếp: {nextLesson.title} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : !nextLesson && done ? (
          <Link to="/pinyin/drill/tone-pairs" className="inline-flex items-center gap-1 text-primary hover:underline">
            Luyện 20 cặp thanh <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
