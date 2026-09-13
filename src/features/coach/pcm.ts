/**
 * Audio conversion for Gemini Live (docs/PLAN.md §8.5): the microphone is sent
 * as 16 kHz signed 16-bit PCM, and the model answers with 24 kHz PCM.
 */

export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;

/** Linear resampling; good enough for speech and cheap on the main thread. */
export function resampleTo(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  const ratio = toRate / fromRate;
  const length = Math.max(1, Math.round(samples.length * ratio));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const position = index / ratio;
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const weight = position - left;
    output[index] = (samples[left] ?? 0) * (1 - weight) + (samples[right] ?? 0) * weight;
  }
  return output;
}

export function floatToInt16(samples: Float32Array): Int16Array {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    output[index] = Math.round(value * 32767);
  }
  return output;
}

/** The buffer type is explicit because Web Audio only accepts a plain ArrayBuffer. */
export function int16ToFloat(samples: Int16Array): Float32Array<ArrayBuffer> {
  const output = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) output[index] = (samples[index] ?? 0) / 32767;
  return output;
}

export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  // Chunked so a long turn cannot blow the argument limit.
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToInt16(data: string): Int16Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  // The byte length is always even for PCM16, but guard anyway.
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

/** One microphone frame, ready to send. */
export function micFrameToBase64(samples: Float32Array, fromRate: number): string {
  return int16ToBase64(floatToInt16(resampleTo(samples, fromRate, INPUT_SAMPLE_RATE)));
}
