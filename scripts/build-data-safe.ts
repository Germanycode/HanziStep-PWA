/**
 * Builds and validates a complete data pack in an isolated directory, then
 * swaps it into public/. A failed build leaves the last good pack untouched.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './lib/paths';

interface Swap {
  source: string;
  target: string;
  backup: string;
  installed: boolean;
  backedUp: boolean;
}

async function main(): Promise<void> {
  const stamp = `${process.pid}-${Date.now()}`;
  const staging = path.join(ROOT, `.data-build-${stamp}`);
  const runner = process.execPath;
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const paths: readonly (readonly [string, string])[] = [
    ['data/v1', 'data/v1'],
    ['audio/syllables', 'audio/syllables'],
    ['audio/words', 'audio/words'],
  ];
  const swaps: Swap[] = paths.map(([source, target]) => ({
    source: path.join(staging, source),
    target: path.join(ROOT, 'public', target),
    backup: path.join(ROOT, 'public', `${target}.previous-${stamp}`),
    installed: false,
    backedUp: false,
  }));

  await mkdir(staging, { recursive: true });
  try {
    execFileSync(runner, [tsxCli, path.join(ROOT, 'scripts', 'build-all.ts'), '--output-root', staging], { stdio: 'inherit' });
    execFileSync(runner, [tsxCli, path.join(ROOT, 'scripts', 'validate-data.ts'), '--output-root', staging], { stdio: 'inherit' });

    try {
      for (const swap of swaps) {
        await mkdir(path.dirname(swap.target), { recursive: true });
        if (existsSync(swap.target)) {
          await rename(swap.target, swap.backup);
          swap.backedUp = true;
        }
        await rename(swap.source, swap.target);
        swap.installed = true;
      }
    } catch (error) {
      for (const swap of [...swaps].reverse()) {
        if (swap.installed) await rm(swap.target, { recursive: true, force: true });
        if (swap.backedUp && existsSync(swap.backup)) await rename(swap.backup, swap.target);
      }
      throw error;
    }

    for (const swap of swaps) await rm(swap.backup, { recursive: true, force: true });
    console.log('Data pack validated and swapped into public/.');
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
