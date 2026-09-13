/**
 * Microphone capture worklet for the AI Coach.
 *
 * Runs on the audio thread and posts fixed-size mono frames to the page, which
 * resamples them to 16 kHz and decides (voiceGate) whether to send them.
 */
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const frameSize = options?.processorOptions?.frameSize;
    this.frameSize = typeof frameSize === 'number' && frameSize > 0 ? frameSize : 1024;
    this.buffer = new Float32Array(this.frameSize);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let index = 0; index < channel.length; index++) {
      this.buffer[this.filled++] = channel[index];
      if (this.filled === this.frameSize) {
        // Copy: the buffer is reused for the next frame.
        this.port.postMessage(this.buffer.slice(0));
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('mic-capture', MicCaptureProcessor);
