/**
 * Downloads raw datasets into data-raw/ (gitignored) and records their
 * checksums in data-raw/SOURCES.lock.json. Existing files are reused unless
 * `--force` is passed.
 *
 *   npm run data:fetch [-- --force]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AUDIO_CMN, DOWNLOADS } from './lib/datasets';
import { download, formatBytes, sha256, writeJson } from './lib/io';
import { rawPath } from './lib/paths';

const force = process.argv.includes('--force');

function fetchAudioCmn(): void {
  const dir = rawPath(AUDIO_CMN.dir);
  if (!existsSync(path.join(dir, '.git'))) {
    console.log('audio-cmn            sparse clone of', AUDIO_CMN.sparsePaths.join(', '));
    execFileSync('git', ['clone', '--filter=blob:none', '--sparse', '--no-checkout', AUDIO_CMN.repo, dir], {
      stdio: 'inherit',
    });
  }
  execFileSync('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', AUDIO_CMN.commit], { stdio: 'inherit' });
  execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', ...AUDIO_CMN.sparsePaths], { stdio: 'inherit' });
  execFileSync('git', ['-C', dir, 'checkout', '--detach', AUDIO_CMN.commit], { stdio: 'inherit' });
  // Also adds folders to an older checkout that only had the syllables.
  const missing = AUDIO_CMN.sparsePaths.filter((sparsePath) => !existsSync(path.join(dir, sparsePath)));
  if (missing.length > 0) {
    console.log('audio-cmn            checking out', AUDIO_CMN.sparsePaths.join(', '));
    execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', ...AUDIO_CMN.sparsePaths], { stdio: 'inherit' });
  } else {
    console.log('audio-cmn            already present');
  }
}

async function main(): Promise<void> {
  const lock: Record<string, { url: string; file: string; bytes: number; sha256: string; checkedAt: string }> = {};
  for (const spec of DOWNLOADS) {
    const dest = rawPath(spec.file);
    const { bytes, skipped } = await download(spec.url, dest, force, spec.sha256);
    lock[spec.id] = {
      url: spec.url,
      file: spec.file,
      bytes,
      sha256: sha256(await readFile(dest)),
      checkedAt: new Date().toISOString(),
    };
    console.log(`${spec.id.padEnd(20)} ${skipped ? 'already present' : 'downloaded'} (${formatBytes(bytes)})`);
  }
  fetchAudioCmn();
  await writeJson(rawPath('SOURCES.lock.json'), lock, true);
  console.log('\nDone. Next: npm run data:build');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
