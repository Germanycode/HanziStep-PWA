import type { Settings } from '@/domain/types';
import { fetchJson, fetchWithTimeout } from '@/lib/http';

export type ImageSource = 'pixabay' | 'unsplash';

export const SOURCE_LABELS: Record<ImageSource, string> = { pixabay: 'Pixabay', unsplash: 'Unsplash' };

export interface ImageCandidate {
  id: string;
  source: ImageSource;
  previewUrl: string;
  fullUrl: string;
  /** Page to link when crediting the photographer. */
  pageUrl: string;
  author: string;
  tags: string;
  /** Unsplash asks clients to call this when a photo is really used. */
  downloadLocation?: string;
}

interface PixabayHit {
  id: number;
  previewURL: string;
  webformatURL: string;
  pageURL: string;
  user: string;
  tags: string;
}

interface UnsplashHit {
  id: string;
  urls: { small: string; regular: string };
  links: { html: string; download_location?: string };
  user: { name: string };
  alt_description?: string | null;
}

const PIXABAY_ENDPOINT = 'https://pixabay.com/api/';
const UNSPLASH_ENDPOINT = 'https://api.unsplash.com/search/photos';
const PER_PAGE = 12;

export type ImageKeys = Pick<Settings, 'pixabayApiKey' | 'unsplashApiKey'>;

export function availableSources(settings: ImageKeys): ImageSource[] {
  const sources: ImageSource[] = [];
  if (settings.pixabayApiKey.trim()) sources.push('pixabay');
  if (settings.unsplashApiKey.trim()) sources.push('unsplash');
  return sources;
}

/** Pixabay only accepts the key as a query parameter; it never leaves this browser. */
export async function searchPixabay(apiKey: string, query: string, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const url = new URL(PIXABAY_ENDPOINT);
  url.searchParams.set('key', apiKey.trim());
  url.searchParams.set('q', query);
  url.searchParams.set('image_type', 'photo');
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('per_page', String(PER_PAGE));
  const data = await fetchJson<{ hits?: PixabayHit[] }>(url, { signal }, 12_000);
  return (data.hits ?? []).map((hit) => ({
    id: `pixabay-${hit.id}`,
    source: 'pixabay',
    previewUrl: hit.previewURL,
    fullUrl: hit.webformatURL,
    pageUrl: hit.pageURL,
    author: hit.user,
    tags: hit.tags,
  }));
}

export async function searchUnsplash(accessKey: string, query: string, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const url = new URL(UNSPLASH_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('content_filter', 'high');
  const data = await fetchJson<UnsplashResponse>(url, { signal, headers: { Authorization: `Client-ID ${accessKey.trim()}` } }, 12_000);
  return (data.results ?? []).map((hit) => ({
    id: `unsplash-${hit.id}`,
    source: 'unsplash',
    previewUrl: hit.urls.small,
    fullUrl: hit.urls.regular,
    pageUrl: hit.links.html,
    author: hit.user.name,
    tags: hit.alt_description ?? query,
    downloadLocation: hit.links.download_location,
  }));
}

interface UnsplashResponse {
  results?: UnsplashHit[];
}

/** Unsplash's guidelines: tell them when a photo is actually used. Failures are ignored. */
export async function pingUnsplashDownload(accessKey: string, downloadLocation: string): Promise<void> {
  try {
    await fetchWithTimeout(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey.trim()}` } }, 6000);
  } catch {
    // Attribution ping only; never block saving the picture.
  }
}

/** Searches every service the learner has a key for, alternating the results. */
export async function searchImages(settings: ImageKeys, query: string, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const sources = availableSources(settings);
  if (sources.length === 0) throw new Error('Chưa có API key Pixabay hoặc Unsplash trong Cài đặt.');

  const results = await Promise.all(
    sources.map((source) =>
      (source === 'pixabay'
        ? searchPixabay(settings.pixabayApiKey, query, signal)
        : searchUnsplash(settings.unsplashApiKey, query, signal)
      ).catch(() => [] as ImageCandidate[]),
    ),
  );
  if (results.every((list) => list.length === 0)) throw new Error('Không tìm được ảnh nào (kiểm tra API key hoặc từ khoá).');

  const merged: ImageCandidate[] = [];
  for (let index = 0; index < PER_PAGE; index++) {
    for (const list of results) {
      const candidate = list[index];
      if (candidate) merged.push(candidate);
    }
  }
  return merged;
}
