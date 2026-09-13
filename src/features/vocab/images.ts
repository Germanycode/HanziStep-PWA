import { db, type HanziStepDB } from '@/db/db';
import type { Word } from '@/domain/types';
import type { ImageCandidate, ImageKeys } from '@/services/images/providers';
import { loadImage, removeImage, saveImage, useStoredImage, type DisplayImage } from '@/services/images/store';

export type { ImageCandidate } from '@/services/images/providers';
export { searchImages } from '@/services/images/providers';

/** Pixabay and Unsplash search in English, so the English gloss finds the best pictures. */
export function imageQueryFor(word: Word): string {
  const gloss = word.meaningEn[0] ?? word.meaningVi[0] ?? word.simplified;
  return (
    gloss
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .split(/[;,/]/)[0]
      ?.replace(/\b(to|a|an|the|of)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || word.simplified
  );
}

/** Stores the picture itself; `imageUrl` only keeps the page to credit. */
export async function saveWordImage(
  word: Word,
  candidate: ImageCandidate,
  keys?: ImageKeys,
  database: HanziStepDB = db,
): Promise<void> {
  await saveImage(word.id, candidate, keys, database);
  await database.words.update(word.id, { imageStatus: 'ok', imageUrl: candidate.pageUrl, updatedAt: Date.now() });
}

export async function removeWordImage(wordId: string, database: HanziStepDB = db): Promise<void> {
  await removeImage(wordId, database);
  await database.words.update(wordId, { imageStatus: 'none', imageUrl: undefined, updatedAt: Date.now() });
}

export function loadWordImage(wordId: string, database: HanziStepDB = db) {
  return loadImage(wordId, database);
}

export function useWordImage(word: Word): DisplayImage | null {
  return useStoredImage(word.id, word.imageStatus === 'ok');
}
