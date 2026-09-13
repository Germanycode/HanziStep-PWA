import { int16ToFloat, OUTPUT_SAMPLE_RATE } from './pcm';

/**
 * Plays the coach's 24 kHz PCM chunks back to back, and stops immediately when
 * the learner talks over it (docs/PLAN.md §8.5).
 */
export class PcmPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private cursor = 0;

  constructor(private readonly sampleRate: number = OUTPUT_SAMPLE_RATE) {}

  private ensure(): { context: AudioContext; gain: GainNode } {
    if (!this.context || !this.gain) {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.connect(context.destination);
      this.context = context;
      this.gain = gain;
      this.cursor = context.currentTime;
    }
    return { context: this.context, gain: this.gain };
  }

  get playing(): boolean {
    return this.sources.size > 0;
  }

  /** Queues one chunk right after whatever is already scheduled. */
  play(pcm: Int16Array): void {
    if (pcm.length === 0) return;
    const { context, gain } = this.ensure();
    void context.resume();

    const buffer = context.createBuffer(1, pcm.length, this.sampleRate);
    buffer.copyToChannel(int16ToFloat(pcm), 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    const startAt = Math.max(context.currentTime + 0.02, this.cursor);
    source.start(startAt);
    this.cursor = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  /** Barge-in: drop everything that has not been heard yet. */
  stop(): void {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished.
      }
    }
    this.sources.clear();
    this.cursor = this.context?.currentTime ?? 0;
  }

  /** Quiet while the learner speaks, without losing the queue. */
  setDucked(ducked: boolean): void {
    const { context, gain } = this.ensure();
    gain.gain.setTargetAtTime(ducked ? 0.05 : 1, context.currentTime, 0.05);
  }

  async close(): Promise<void> {
    this.stop();
    await this.context?.close();
    this.context = null;
    this.gain = null;
  }
}
