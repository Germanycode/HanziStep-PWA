import { HanziStepDB } from '@/db/db';
import { DICT_IMPORT_KEY, dictRowToEntry, type DictImportState } from './dictionary';
import type { DictRow } from './types';
import { sha256Hex } from './integrity';

export type DictImportRequest = { url: string; sha256: string; contentSha256?: string };
export type DictImportMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; count: number }
  | { type: 'error'; message: string };

const scope = self as unknown as {
  postMessage: (message: DictImportMessage) => void;
  onmessage: ((event: MessageEvent<DictImportRequest>) => void) | null;
};

const BATCH_SIZE = 5000;

async function readRows(url: string, expectedSha256: string, expectedContentSha256?: string): Promise<DictRow[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} khi tải từ điển`);
  const buffer = await response.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  // Some servers decompress .gz transparently; only gunzip when the gzip magic bytes are present.
  const isGzip = head[0] === 0x1f && head[1] === 0x8b;
  const actualSha256 = await sha256Hex(buffer);
  const expected = (isGzip ? expectedSha256 : expectedContentSha256 ?? expectedSha256).toLowerCase();
  if (actualSha256 !== expected) throw new Error('Từ điển tải về không khớp checksum. Hãy tải lại gói dữ liệu.');
  const text = isGzip
    ? await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(buffer);
  return JSON.parse(text) as DictRow[];
}

async function importDictionary({ url, sha256, contentSha256 }: DictImportRequest): Promise<void> {
  const database = new HanziStepDB();
  try {
    const rows = await readRows(url, sha256, contentSha256);
    // All batches and the import marker commit together. Closing the tab,
    // quota errors or a bad row roll the clear operation back as well.
    await database.transaction('rw', [database.dict, database.kv], async () => {
      await database.dict.clear();
      for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        await database.dict.bulkAdd(rows.slice(start, start + BATCH_SIZE).map(dictRowToEntry));
        scope.postMessage({ type: 'progress', done: Math.min(start + BATCH_SIZE, rows.length), total: rows.length });
      }
      const state: DictImportState = { sha256, count: rows.length, importedAt: Date.now() };
      await database.kv.put({ key: DICT_IMPORT_KEY, value: state });
    });
    scope.postMessage({ type: 'done', count: rows.length });
  } finally {
    database.close();
  }
}

scope.onmessage = (event) => {
  importDictionary(event.data).catch((error: unknown) => {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  });
};
