import { useEffect, useState } from 'react';
import { db, type HanziStepDB } from '@/db/db';
import { pingUnsplashDownload, type ImageCandidate, type ImageKeys, type ImageSource } from './providers';

export const IMAGE_KIND = 'image';
/** Pictures live until their owner is deleted; the caches table still wants an expiry. */
const KEEP_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export interface StoredImage {
  blob: Blob;
  /** Size recorded when saving, so the storage report never has to read the blob back. */
  bytes: number;
  source: ImageSource;
  pageUrl: string;
  author: string;
}

export function imageCacheKey(ownerId: string): string {
  return `${IMAGE_KIND}:${ownerId}`;
}

export function isStoredImage(value: unknown): value is StoredImage {
  if (typeof value !== 'object' || value === null || !('blob' in value)) return false;
  const blob = (value as { blob?: unknown }).blob;
  // IndexedDB may return a Blob from another realm, where `instanceof Blob`
  // is false even though the value is a valid Blob.
  return (
    typeof blob === 'object' &&
    blob !== null &&
    'size' in blob &&
    typeof (blob as { size?: unknown }).size === 'number' &&
    'arrayBuffer' in blob &&
    typeof (blob as { arrayBuffer?: unknown }).arrayBuffer === 'function'
  );
}

/**
 * Downloads the picture and keeps the bytes on this machine: Pixabay and
 * Unsplash URLs expire, so a stored link would break sooner or later.
 */
export async function saveImage(
  ownerId: string,
  candidate: ImageCandidate,
  keys?: ImageKeys,
  database: HanziStepDB = db,
): Promise<StoredImage> {
  const response = await fetch(candidate.fullUrl);
  if (!response.ok) throw new Error(`Không tải được ảnh (HTTP ${response.status}).`);
  const blob = await response.blob();
  const stored: StoredImage = {
    blob,
    bytes: blob.size,
    source: candidate.source,
    pageUrl: candidate.pageUrl,
    author: candidate.author,
  };
  const now = Date.now();
  await database.caches.put({ key: imageCacheKey(ownerId), kind: IMAGE_KIND, value: stored, createdAt: now, expiresAt: now + KEEP_MS });
  if (candidate.source === 'unsplash' && candidate.downloadLocation && keys?.unsplashApiKey) {
    void pingUnsplashDownload(keys.unsplashApiKey, candidate.downloadLocation);
  }
  return stored;
}

export async function loadImage(ownerId: string, database: HanziStepDB = db): Promise<StoredImage | null> {
  const entry = await database.caches.get(imageCacheKey(ownerId));
  return isStoredImage(entry?.value) ? entry.value : null;
}

export async function removeImage(ownerId: string, database: HanziStepDB = db): Promise<void> {
  await database.caches.delete(imageCacheKey(ownerId));
}

export interface DisplayImage extends StoredImage {
  /** Object URL, revoked when the owner changes or the component unmounts. */
  url: string;
}

/** The stored picture for a word or a text, ready to render. */
export function useStoredImage(ownerId: string | null, enabled = true): DisplayImage | null {
  const [loaded, setLoaded] = useState<{ ownerId: string; image: DisplayImage } | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) return;
    let objectUrl: string | null = null;
    let active = true;
    loadImage(ownerId).then(
      (image) => {
        if (!active || !image) return;
        objectUrl = URL.createObjectURL(image.blob);
        setLoaded({ ownerId, image: { ...image, url: objectUrl } });
      },
      () => {},
    );
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ownerId, enabled]);

  return ownerId && enabled && loaded?.ownerId === ownerId ? loaded.image : null;
}
