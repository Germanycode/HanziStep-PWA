import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { updateSettings } from '@/db/settings';
import type { Settings } from '@/domain/types';
import { playSyllableSequence } from '@/services/audio/sequence';
import { isSpeechSynthesisSupported, listChineseVoices, speak } from '@/services/speech/tts';
import type { VoiceInfo } from '@/services/speech/voices';
import { AudioButton } from '@/ui/AudioButton';
import { Card } from '@/ui/Card';
import { Field, SelectInput } from '@/ui/form';

export function VoiceCard({ settings }: { settings: Settings }) {
  const voiceId = useId();
  const rateId = useId();
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [rateDraft, setRateDraft] = useState<number | null>(null);
  const rate = rateDraft ?? settings.ttsRate;

  useEffect(() => {
    void listChineseVoices().then(setVoices);
  }, []);

  const commitRate = () => {
    if (rateDraft === null) return;
    void updateSettings({ ttsRate: rateDraft }).then(() => setRateDraft(null));
  };

  const noVoices = voices !== null && voices.length === 0;

  return (
    <Card
      title="Giọng đọc tiếng Trung"
      description="Âm tiết lẻ dùng bản ghi giọng người thật; câu và từ dùng giọng đọc của máy."
    >
      <div className="space-y-4">
        {!isSpeechSynthesisSupported() || noVoices ? (
          <div className="rounded-xl bg-warning/10 p-3 text-sm text-fg">
            <p className="font-semibold">Chưa thấy giọng đọc tiếng Trung trên máy.</p>
            <p className="mt-1 text-sub">
              Cách nhanh nhất: mở HanziStep bằng Microsoft Edge (có sẵn giọng Xiaoxiao Natural). Hoặc trên Windows vào Cài đặt → Thời gian
              &amp; ngôn ngữ → Giọng nói → Thêm giọng → “Tiếng Trung (Giản thể, Trung Quốc)”, rồi mở lại trình duyệt.
            </p>
          </div>
        ) : (
          <Field label="Giọng đọc" htmlFor={voiceId} hint={voices === null ? 'Đang tìm giọng đọc…' : `${voices.length} giọng tiếng Trung khả dụng.`}>
            <SelectInput
              id={voiceId}
              value={settings.ttsVoiceURI}
              onChange={(event) => void updateSettings({ ttsVoiceURI: event.target.value })}
            >
              <option value="">Tự động (giọng tốt nhất)</option>
              {(voices ?? []).map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </SelectInput>
          </Field>
        )}

        <Field label="Tốc độ đọc" htmlFor={rateId} hint={`${Math.round(rate * 100)}% tốc độ bình thường.`}>
          <input
            id={rateId}
            type="range"
            min={0.6}
            max={1.2}
            step={0.05}
            value={rate}
            onChange={(event) => setRateDraft(Number(event.target.value))}
            onPointerUp={commitRate}
            onKeyUp={commitRate}
            onBlur={commitRate}
            className="mt-3 w-full max-w-72 accent-primary"
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <AudioButton
            label="Nghe thử giọng máy"
            onPlay={() => speak('妈，麻，马，骂。银行。', { rate: settings.ttsRate, voiceURI: settings.ttsVoiceURI || undefined })}
            className="border border-line px-4 py-2 text-sm"
          >
            Giọng máy: 妈 麻 马 骂 · 银行
          </AudioButton>
          <AudioButton
            label="Nghe bản ghi thật"
            onPlay={() =>
              playSyllableSequence(parsePinyin('ma1 ma2 ma3 ma4').syllables, { gapMs: 300 }).catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : 'Không phát được bản ghi.');
              })
            }
            className="border border-line px-4 py-2 text-sm"
          >
            Bản ghi thật: mā má mǎ mà
          </AudioButton>
        </div>
      </div>
    </Card>
  );
}
