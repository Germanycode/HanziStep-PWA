import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
/** Raw downloads (gitignored). */
export const RAW_DIR = path.join(ROOT, 'data-raw');
/** Generated data served by the app. */
const outputFlag = process.argv.indexOf('--output-root');
/** Optional isolated public root used by the safe data builder. */
export const PUBLIC_OUT_ROOT =
  outputFlag >= 0 && process.argv[outputFlag + 1] ? path.resolve(process.argv[outputFlag + 1]!) : path.join(ROOT, 'public');
export const DATA_OUT_DIR = path.join(PUBLIC_OUT_ROOT, 'data', 'v1');
export const SYLLABLE_AUDIO_DIR = path.join(PUBLIC_OUT_ROOT, 'audio', 'syllables');
export const WORD_AUDIO_DIR = path.join(PUBLIC_OUT_ROOT, 'audio', 'words');

export function rawPath(...parts: string[]): string {
  return path.join(RAW_DIR, ...parts);
}

export function outPath(...parts: string[]): string {
  return path.join(DATA_OUT_DIR, ...parts);
}
