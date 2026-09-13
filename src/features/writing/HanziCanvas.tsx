import { useEffect, useRef, useState } from 'react';

interface HanziCanvasProps {
  character: string;
  mode: 'animate' | 'quiz';
  showOutline?: boolean;
  hintRequested?: boolean;
  restartToken?: number;
  onMistake?: () => void;
  onComplete?: (mistakes: number) => void;
}

export function HanziCanvas({
  character,
  mode,
  showOutline = true,
  hintRequested = false,
  restartToken = 0,
  onMistake,
  onComplete,
}: HanziCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const complete = useRef(onComplete);
  const mistake = useRef(onMistake);
  const writerRef = useRef<import('hanzi-writer').default | undefined>(undefined);
  const hint = useRef(hintRequested);
  const [error, setError] = useState('');

  useEffect(() => {
    complete.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    mistake.current = onMistake;
  }, [onMistake]);

  useEffect(() => {
    let disposed = false;
    let writer: import('hanzi-writer').default | undefined;
    void import('hanzi-writer').then(({ default: HanziWriter }) => {
      if (disposed || !host.current) return;
      setError('');
      host.current.replaceChildren();
      writer = HanziWriter.create(host.current, character, {
        width: 280,
        height: 280,
        padding: 12,
        showOutline,
        showCharacter: mode === 'animate',
        strokeColor: '#f06b4f',
        radicalColor: '#55b6b3',
        outlineColor: '#7c8494',
        drawingColor: '#f6c85f',
        onLoadCharDataError: (reason) => {
          if (!disposed) {
            const detail = reason instanceof Error ? ` (${reason.message})` : '';
            setError(`Chưa có dữ liệu nét cho chữ này.${detail}`);
          }
        },
        charDataLoader: (char, done, fail) => {
          fetch(`/data/v1/hanzi/${encodeURIComponent(char)}.json`)
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.json();
            })
            .then(done, fail);
        },
      });
      writerRef.current = writer;
      if (mode === 'animate') void writer.animateCharacter();
      else {
        void writer.quiz({
          showHintAfterMisses: 3,
          onMistake: () => mistake.current?.(),
          onComplete: ({ totalMistakes }) => complete.current?.(totalMistakes),
        });
        if (hint.current) void writer.showOutline();
      }
    }).catch(() => setError('Chưa có dữ liệu nét cho chữ này.'));
    return () => {
      disposed = true;
      writer?.cancelQuiz();
      if (writerRef.current === writer) writerRef.current = undefined;
    };
  }, [character, mode, restartToken, showOutline]);

  useEffect(() => {
    hint.current = hintRequested;
    if (hintRequested) void writerRef.current?.showOutline();
  }, [hintRequested]);

  return (
    <div className="flex min-h-72 items-center justify-center rounded-2xl bg-white/95 p-2">
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : <div ref={host} aria-label={`Bảng tập viết chữ ${character}`} />}
    </div>
  );
}
