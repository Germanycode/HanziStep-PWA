import { describe, expect, it } from 'vitest';
import { sha256Hex } from './integrity';

describe('sha256Hex', () => {
  it('matches the published SHA-256 vector for abc', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(Uint8Array.from(bytes).buffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
