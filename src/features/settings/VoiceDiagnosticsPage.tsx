import { ArrowLeft, CircleCheck, CircleX } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { loadWordAudioIndex, wordAudioUrl } from '@/data/wordAudio';
import { useSettings } from '@/db/settings';
import { playClip, playSyllable } from '@/services/audio/clips';
import { checkOnDevice, recognitionSupport } from '@/services/speech/recognition';
import { recorderSupport } from '@/services/speech/recorder';
import { listChineseVoices, speak } from '@/services/speech/tts';
import type { VoiceInfo } from '@/services/speech/voices';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';

const TONE_WORDS = [
  { hanzi: '妈', tone: 1, gloss: 'mẹ' },
  { hanzi: '麻', tone: 2, gloss: 'cây gai' },
  { hanzi: '马', tone: 3, gloss: 'con ngựa' },
  { hanzi: '骂', tone: 4, gloss: 'mắng' },
];

function Row({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 py-1 text-sm">
      {ok ? <CircleCheck className="mt-0.5 size-4 text-success" aria-hidden /> : <CircleX className="mt-0.5 size-4 text-warning" aria-hidden />}
      <span className="min-w-0 text-sub">{children}</span>
    </li>
  );
}

/** "Kiểm tra giọng đọc": what this browser can and cannot do (docs/PLAN.md §8.1, §8.4). */
export function VoiceDiagnosticsPage() {
  const settings = useSettings();
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [onDevice, setOnDevice] = useState<boolean | null>(null);
  const [hasWordAudio, setHasWordAudio] = useState<boolean | null>(null);
  const recognition = recognitionSupport();
  const recorder = recorderSupport();

  useEffect(() => {
    let active = true;
    listChineseVoices().then(
      (found) => {
        if (active) setVoices(found);
      },
      () => {
        if (active) setVoices([]);
      },
    );
    void checkOnDevice().then((value) => {
      if (active) setOnDevice(value);
    });
    loadWordAudioIndex().then(
      (index) => {
        if (active) setHasWordAudio(index.has('银行'));
      },
      () => {
        if (active) setHasWordAudio(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const play = (action: () => Promise<void>) => {
    void action().catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Không phát được.'));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Cài đặt
      </Link>
      <PageHeader title="Kiểm tra giọng đọc" subtitle="Xem máy này đọc và nghe tiếng Trung được tới đâu." />

      <Card title="Bốn thanh điệu" description="Đây là bản ghi âm thật, không phải giọng máy.">
        <div className="flex flex-wrap gap-3">
          {TONE_WORDS.map((item) => (
            <Button key={item.hanzi} variant="outline" onClick={() => play(() => playSyllable('ma', item.tone))}>
              <span className="font-hanzi text-lg">{item.hanzi}</span> ma{item.tone} · {item.gloss}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={hasWordAudio === false}
            onClick={() => play(() => playClip(wordAudioUrl('银行')))}
          >
            <span className="font-hanzi">银行</span> yín háng
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              play(() => speak('银行在哪儿？', { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI || undefined }))
            }
          >
            Đọc câu bằng giọng máy
          </Button>
          {hasWordAudio === false && <span className="text-xs text-warning">Chưa có gói âm thanh từ vựng.</span>}
        </div>
      </Card>

      <Card title="Giọng đọc tiếng Trung trên máy này">
        {voices === null && <p className="text-sub">Đang tìm giọng…</p>}
        {voices?.length === 0 && (
          <p className="text-sm text-warning">
            Không có giọng tiếng Trung nào. Trên Windows: Settings → Time &amp; language → Language &amp; region → thêm 中文(简体，中国) và cài
            gói Speech.
          </p>
        )}
        {voices && voices.length > 0 && (
          <ul className="divide-y divide-line">
            {voices.map((voice) => (
              <li key={voice.voiceURI} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-fg">{voice.name}</span>
                <span className="text-muted">{voice.lang}</span>
                <span className="text-muted">{voice.localService ? 'trên máy' : 'qua mạng'}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => play(() => speak('你好，我是你的中文老师。', { voiceURI: voice.voiceURI, rate: settings.ttsRate }))}
                >
                  Nghe thử
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Nghe bạn nói" description="Khác nhau giữa các trình duyệt.">
        <ul>
          <Row ok={recognition.supported}>Nhận dạng giọng nói: {recognition.note}</Row>
          <Row ok={onDevice === true}>
            {onDevice === null ? 'Trình duyệt không cho biết có nhận dạng ngay trên máy hay không.' : onDevice ? 'Có thể nhận dạng ngay trên máy.' : 'Nhận dạng qua máy chủ của hãng trình duyệt.'}
          </Row>
          <Row ok={recorder.supported}>Ghi âm (dùng cho Luyện nhại): {recorder.note}</Row>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Chrome và Edge đều gửi giọng nói lên máy chủ để nhận dạng; Firefox chưa hỗ trợ. Máy nhận dạng không nghe được thanh điệu, nên phần
          thanh điệu luôn luyện bằng bài nghe trong mục Phát âm.
        </p>
      </Card>
    </div>
  );
}
