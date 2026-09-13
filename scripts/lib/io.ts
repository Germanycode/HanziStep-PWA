import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function writeOutput(file: string, content: string | Uint8Array): Promise<void> {
  await ensureDir(path.dirname(file));
  await writeFile(file, content);
}

export async function writeJson(file: string, value: unknown, pretty = false): Promise<void> {
  await writeOutput(file, JSON.stringify(value, null, pretty ? 2 : undefined));
}

export async function writeGzipJson(file: string, value: unknown): Promise<void> {
  await writeOutput(file, gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 }));
}

/** Downloads `url` to `dest` unless it already exists (or `force`). */
export async function download(url: string, dest: string, force = false, expectedSha256?: string): Promise<{ bytes: number; skipped: boolean }> {
  if (!force && existsSync(dest)) {
    const existing = await readFile(dest);
    if (!expectedSha256 || sha256(existing) === expectedSha256) return { bytes: (await stat(dest)).size, skipped: true };
  }
  const response = await fetch(url, { headers: { 'User-Agent': 'hanzistep-data-pipeline' } });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (expectedSha256 && sha256(buffer) !== expectedSha256) {
    throw new Error(`Checksum mismatch for ${url}; upstream content changed and the release lock must be reviewed.`);
  }
  await ensureDir(path.dirname(dest));
  const temporary = `${dest}.download-${process.pid}-${Date.now()}.tmp`;
  try {
    await writeFile(temporary, buffer);
    await rename(temporary, dest);
  } finally {
    await rm(temporary, { force: true });
  }
  return { bytes: buffer.length, skipped: false };
}

/** Relative POSIX paths of every file under `dir`. */
export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
