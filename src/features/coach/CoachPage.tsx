import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, Mic, PhoneOff, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import { pendingWordsToLearn } from '@/features/vocab/repository';
import { announceActivity } from '@/progress/announce';
import { coachSystemPrompt, COACH_SCENARIOS, type CoachScenario } from '@/services/ai/prompts/coach';
import { duckMusic, unduckMusic } from '@/services/audio/mixer';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { SelectInput } from '@/ui/form';
import { LiveSession } from './liveSocket';
import { micFrameToBase64 } from './pcm';
import { PcmPlayer } from './playback';
import { listCoachSessions, saveCoachSession, type TranscriptLine } from './repository';
import { initialGate, rms, stepGate, type GateState } from './voiceGate';

type Status = 'idle' | 'connecting' | 'live';

const FRAME_SIZE = 1024;
/** Transcript chunks closer than this are joined into one line. */
const MERGE_WINDOW_MS = 2500;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CoachPage() {
  const settings = useSettings();
  const [scenario, setScenario] = useState<CoachScenario>(COACH_SCENARIOS[0]!);
  const [status, setStatus] = useState<Status>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const sessionRef = useRef<LiveSession | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const audioRef = useRef<{ context?: AudioContext; stream: MediaStream; node?: AudioWorkletNode; source?: MediaStreamAudioSourceNode } | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const gateRef = useRef<GateState>(initialGate());
  const speakingRef = useRef(false);
  const startedAtRef = useRef(0);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const savedStartedAtRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  const past = useLiveQuery(() => listCoachSessions(), []);

  const appendLine = (role: TranscriptLine['role'], text: string) => {
    const now = Date.now();
    setTranscript((lines) => {
      const last = lines.at(-1);
      const next =
        last && last.role === role && now - last.at < MERGE_WINDOW_MS
          ? [...lines.slice(0, -1), { ...last, text: `${last.text}${text}` }]
          : [...lines, { role, text, at: now }];
      transcriptRef.current = next;
      return next;
    });
  };

  const teardown = async () => {
    const audio = audioRef.current;
    if (audio) {
      if (audio.node) {
        audio.node.port.onmessage = null;
        audio.node.disconnect();
      }
      audio.source?.disconnect();
      for (const track of audio.stream.getTracks()) track.stop();
      if (audio.context && audio.context.state !== 'closed') await audio.context.close();
      audioRef.current = null;
    }
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.close();
    await playerRef.current?.close();
    playerRef.current = null;
    unduckMusic('coach');
    gateRef.current = initialGate();
    speakingRef.current = false;
    setSpeaking(false);
  };

  useEffect(
    () => () => {
      void teardown();
    },
    // Only on unmount; the handler closes whatever is open at that moment.
    [],
  );

  const saveCurrentTranscript = async (announce: boolean) => {
    const lines = transcriptRef.current;
    const startedAt = startedAtRef.current;
    if (lines.length === 0 || startedAt === 0 || savedStartedAtRef.current === startedAt) return;
    savedStartedAtRef.current = startedAt;
    try {
      const { activity } = await saveCoachSession({ scenario: scenario.label, startedAt, transcript: lines });
      if (announce && activity) announceActivity(activity, 'Nói chuyện với AI Coach');
      else if (announce) toast('Đã lưu hội thoại.');
    } catch (error) {
      savedStartedAtRef.current = 0;
      toast.error(errorText(error));
    }
  };

  const start = async () => {
    if (!settings.geminiApiKey.trim()) {
      toast.error('Cần Gemini API key trong Cài đặt.');
      return;
    }
    setStatus('connecting');
    setTranscript([]);
    transcriptRef.current = [];
    startedAtRef.current = 0;
    savedStartedAtRef.current = 0;
    intentionalCloseRef.current = false;
    try {
      const [words, pending] = await Promise.all([db.words.orderBy('updatedAt').reverse().toArray(), pendingWordsToLearn()]);
      const player = new PcmPlayer();
      playerRef.current = player;

      const session = new LiveSession({
        apiKey: settings.geminiApiKey,
        model: settings.geminiLiveModel,
        systemPrompt: coachSystemPrompt({
          level: settings.currentLevel,
          learnedWords: words.map((word) => word.simplified),
          targets: pending.slice(0, 5).map((word) => word.simplified),
          scenario,
        }),
        callbacks: {
          onAudio: (pcm) => player.play(pcm),
          onText: (text, role) => appendLine(role === 'model' ? 'ai' : 'user', text),
          onInterrupted: () => player.stop(),
          onError: (error) => toast.error(error.message),
          onClose: () => {
            setStatus('idle');
            if (!intentionalCloseRef.current) void saveCurrentTranscript(false);
            void teardown();
          },
        },
      });
      sessionRef.current = session;
      const connectController = new AbortController();
      connectAbortRef.current = connectController;
      await session.connect(connectController.signal);
      connectAbortRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const audioResources: NonNullable<typeof audioRef.current> = { stream };
      audioRef.current = audioResources;
      const context = new AudioContext();
      audioResources.context = context;
      await context.audioWorklet.addModule('/worklets/mic-capture.js');
      const source = context.createMediaStreamSource(stream);
      audioResources.source = source;
      const node = new AudioWorkletNode(context, 'mic-capture', { processorOptions: { frameSize: FRAME_SIZE } });
      audioResources.node = node;
      source.connect(node);

      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const frame = event.data;
        const result = stepGate(gateRef.current, { rms: rms(frame), now: performance.now() });
        gateRef.current = { open: result.open, quietFrames: result.quietFrames, tailUntil: result.tailUntil, duckUntil: result.duckUntil };
        if (result.send) session.sendAudio(micFrameToBase64(frame, context.sampleRate));
        player.setDucked(result.duck);
        // Re-render only when the state really flips, not 50 times a second.
        if (speakingRef.current !== result.open) {
          speakingRef.current = result.open;
          setSpeaking(result.open);
        }
      };

      duckMusic('coach');
      startedAtRef.current = Date.now();
      setStatus('live');
    } catch (error) {
      toast.error(errorText(error));
      await teardown();
      setStatus('idle');
    }
  };

  const hangUp = async () => {
    intentionalCloseRef.current = true;
    await teardown();
    setStatus('idle');
    await saveCurrentTranscript(true);
    intentionalCloseRef.current = false;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="AI Coach"
        subtitle="Nói chuyện thật với thầy 小林: thầy giải thích bằng tiếng Việt, làm mẫu câu ngắn tiếng Trung."
      />

      {!settings.geminiApiKey && (
        <Card title="Cần Gemini API key">
          <p className="text-sm text-sub">
            Bạn tự tạo key rồi dán vào{' '}
            <Link to="/settings" className="text-primary hover:underline">
              Cài đặt
            </Link>
            . Key chỉ nằm trên máy này.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <SelectInput
            aria-label="Chủ đề"
            value={scenario.id}
            disabled={status !== 'idle'}
            onChange={(event) => setScenario(COACH_SCENARIOS.find((item) => item.id === event.target.value) ?? COACH_SCENARIOS[0]!)}
            className="max-w-60"
          >
            {COACH_SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectInput>

          {status === 'live' ? (
            <Button variant="danger" onClick={() => void hangUp()}>
              <PhoneOff className="size-4" aria-hidden /> Kết thúc
            </Button>
          ) : (
            <Button onClick={() => void start()} disabled={status === 'connecting' || !settings.geminiApiKey}>
              <Mic className="size-4" aria-hidden /> {status === 'connecting' ? 'Đang kết nối…' : 'Bắt đầu nói chuyện'}
            </Button>
          )}

          {status === 'live' && (
            <span className={`inline-flex items-center gap-2 text-sm ${speaking ? 'text-success' : 'text-sub'}`}>
              <span className={`size-2.5 rounded-full ${speaking ? 'animate-pulse bg-success' : 'bg-line'}`} />
              {speaking ? 'Đang nghe bạn nói…' : 'Thầy đang nói / chờ bạn'}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Cứ nói chen vào khi thầy đang nói — thầy sẽ dừng lại. Nhận xét thanh điệu của AI chỉ để tham khảo, không tính vào lịch ôn.
        </p>
      </Card>

      {transcript.length > 0 && (
        <Card title="Nội dung cuộc nói chuyện">
          <ul className="space-y-3">
            {transcript.map((line, index) => (
              <li key={index} className="flex gap-3">
                <span className={`mt-0.5 ${line.role === 'ai' ? 'text-primary' : 'text-accent'}`}>
                  {line.role === 'ai' ? <Bot className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />}
                </span>
                <p className="min-w-0 flex-1 text-sm text-fg">{line.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Muốn tra một từ trong đây? Bôi đen rồi nhấn Ctrl+K.</p>
        </Card>
      )}

      {past && past.length > 0 && (
        <Card title="Những lần trước">
          <ul className="divide-y divide-line">
            {past.map((session) => (
              <li key={session.id} className="py-2 text-sm">
                <span className="text-fg">{session.scenario}</span>{' '}
                <span className="text-muted">
                  · {new Date(session.startedAt).toLocaleString('vi-VN')} · {session.transcript.length} lượt
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
