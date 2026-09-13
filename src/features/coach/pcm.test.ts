import { describe, expect, it } from 'vitest';
import { base64ToInt16, floatToInt16, int16ToBase64, int16ToFloat, micFrameToBase64, resampleTo } from './pcm';

describe('resampleTo', () => {
  it('halves the length when the rate halves', () => {
    const input = Float32Array.from({ length: 100 }, (_, index) => index / 100);
    expect(resampleTo(input, 32_000, 16_000)).toHaveLength(50);
    expect(resampleTo(input, 16_000, 48_000)).toHaveLength(300);
  });

  it('returns the same data when the rate matches', () => {
    const input = new Float32Array([0.1, 0.2]);
    expect(resampleTo(input, 16_000, 16_000)).toBe(input);
    expect(resampleTo(new Float32Array(0), 48_000, 16_000)).toHaveLength(0);
  });

  it('keeps the shape of a ramp', () => {
    const input = Float32Array.from({ length: 9 }, (_, index) => index / 8);
    const output = resampleTo(input, 8000, 4000);
    expect(output[0]).toBeCloseTo(0, 5);
    expect(output[output.length - 1]).toBeCloseTo(1, 1);
  });
});

describe('PCM conversion', () => {
  it('round-trips floats through 16-bit samples', () => {
    const input = new Float32Array([0, 0.5, -0.5, 0.999]);
    const restored = int16ToFloat(floatToInt16(input));
    for (let index = 0; index < input.length; index++) {
      expect(restored[index]).toBeCloseTo(input[index] ?? 0, 4);
    }
  });

  it('clamps anything beyond full scale', () => {
    const clipped = floatToInt16(new Float32Array([2, -2]));
    expect([...clipped]).toEqual([32767, -32767]);
  });

  it('round-trips through base64', () => {
    const samples = Int16Array.from({ length: 1000 }, (_, index) => (index % 2 === 0 ? index : -index));
    expect([...base64ToInt16(int16ToBase64(samples))]).toEqual([...samples]);
  });

  it('encodes a microphone frame at the input rate', () => {
    const frame = Float32Array.from({ length: 480 }, (_, index) => Math.sin(index / 10) * 0.5);
    const encoded = micFrameToBase64(frame, 48_000);
    // 480 samples at 48 kHz become 160 at 16 kHz, i.e. 320 bytes.
    expect(base64ToInt16(encoded)).toHaveLength(160);
  });
});
