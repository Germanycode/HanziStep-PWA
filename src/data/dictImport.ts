import { create } from 'zustand';
import { getDictImportState } from './dictionary';
import type { DictImportMessage } from './dictImport.worker';
import { DATA_BASE_URL, loadDataManifest } from './manifest';

export type DictStatus = 'idle' | 'checking' | 'importing' | 'ready' | 'unavailable' | 'error';

interface DictImportStore {
  status: DictStatus;
  done: number;
  total: number;
  count: number;
  error?: string;
}

export const useDictionaryStatus = create<DictImportStore>()(() => ({ status: 'idle', done: 0, total: 0, count: 0 }));

let running: Promise<void> | null = null;

/**
 * Imports dict/dict.json.gz into IndexedDB in a worker the first time (and
 * whenever the data pack changes). Safe to call repeatedly.
 */
export function ensureDictionary(): Promise<void> {
  running ??= (async () => {
    const set = useDictionaryStatus.setState;
    set({ status: 'checking', error: undefined });
    const manifest = await loadDataManifest();
    const file = manifest?.files.find((item) => item.path === 'dict/dict.json.gz');
    if (!file) {
      set({ status: 'unavailable' });
      return;
    }
    const current = await getDictImportState();
    if (current && current.sha256 === file.sha256 && current.count > 0) {
      set({ status: 'ready', count: current.count, done: current.count, total: current.count });
      return;
    }

    set({ status: 'importing', done: 0, total: manifest?.counts.dictEntries ?? 0 });
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./dictImport.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<DictImportMessage>) => {
        const message = event.data;
        if (message.type === 'progress') set({ done: message.done, total: message.total });
        else if (message.type === 'done') {
          set({ status: 'ready', count: message.count, done: message.count, total: message.count });
          worker.terminate();
          resolve();
        } else {
          worker.terminate();
          reject(new Error(message.message));
        }
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || 'Worker error'));
      };
      // The checksum makes this URL immutable from the service worker's point
      // of view and prevents an older CacheFirst response from being reused.
      worker.postMessage({
        url: `${DATA_BASE_URL}/${file.path}?sha256=${file.sha256}`,
        sha256: file.sha256,
        contentSha256: file.contentSha256,
      });
    });
  })()
    .catch((error: unknown) => {
      useDictionaryStatus.setState({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    })
    .finally(() => {
      running = null;
    });
  return running;
}
