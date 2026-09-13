/** Written by scripts/build-all.ts to public/data/v1/manifest.json. */
export interface DataManifest {
  schema: 1;
  generatedAt: string;
  counts: {
    hskWords: number;
    dictEntries: number;
    hanvietChars: number;
    sentences: number;
    syllables: number;
    syllableAudio: number;
    wordAudio: number;
  };
  files: { path: string; bytes: number; sha256: string; /** Hash after HTTP content decoding, for .gz hosts. */ contentSha256?: string }[];
}

export const DATA_BASE_URL = '/data/v1';

/** Returns null when the data pack has not been built yet (or is unreachable). */
export async function loadDataManifest(): Promise<DataManifest | null> {
  try {
    const response = await fetch(`${DATA_BASE_URL}/manifest.json`, { cache: 'no-cache' });
    // The dev server answers unknown paths with index.html, so check the type too.
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return null;
    const data = (await response.json()) as Partial<DataManifest>;
    return data.schema === 1 && data.counts && Array.isArray(data.files) ? (data as DataManifest) : null;
  } catch {
    return null;
  }
}
