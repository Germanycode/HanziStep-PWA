/**
 * Bundle budget (docs/PLAN.md §9, Phase 5): the JavaScript needed for the first
 * paint must stay at or under 250 KB gzipped. Everything else — the coach, the
 * dictionary worker — may load on demand.
 *
 * Run: npm run size   (after npm run build)
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET_BYTES = 250 * 1024;

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function gzipSize(path: string): Promise<number> {
  return gzipSync(await readFile(path)).length;
}

async function listAssets(): Promise<string[]> {
  const directory = join(DIST, 'assets');
  const entries = await readdir(directory).catch(() => []);
  return entries.filter((name) => name.endsWith('.js')).map((name) => join(directory, name));
}

/** Scripts the entry HTML loads straight away (module scripts and modulepreload). */
function entryScripts(html: string): string[] {
  const matches = [...html.matchAll(/(?:src|href)="\/?([^"]+\.js)"/g)];
  return [...new Set(matches.map((match) => match[1] ?? '').filter(Boolean))];
}

async function main(): Promise<void> {
  const html = await readFile(join(DIST, 'index.html'), 'utf8').catch(() => '');
  if (!html) {
    console.error('No dist/index.html — run "npm run build" first.');
    process.exitCode = 1;
    return;
  }

  const initial = entryScripts(html);
  let initialBytes = 0;
  console.log('Initial JavaScript (loaded before the first paint):');
  for (const relative of initial) {
    const path = join(DIST, relative);
    const exists = await stat(path).then(() => true, () => false);
    if (!exists) continue;
    const size = await gzipSize(path);
    initialBytes += size;
    console.log(`  ${relative.padEnd(48)} ${kb(size).padStart(10)} gzip`);
  }

  const assets = await listAssets();
  const lazy: { path: string; size: number }[] = [];
  for (const path of assets) {
    if (initial.some((relative) => join(DIST, relative) === path)) continue;
    lazy.push({ path, size: await gzipSize(path) });
  }
  if (lazy.length > 0) {
    console.log('\nLoaded on demand:');
    for (const chunk of lazy.sort((a, b) => b.size - a.size).slice(0, 12)) {
      console.log(`  ${chunk.path.padEnd(48)} ${kb(chunk.size).padStart(10)} gzip`);
    }
  }

  const within = initialBytes <= BUDGET_BYTES;
  console.log(
    `\nInitial total: ${kb(initialBytes)} gzip · budget ${kb(BUDGET_BYTES)} · ${
      within ? 'within budget' : `OVER by ${kb(initialBytes - BUDGET_BYTES)}`
    }`,
  );
  if (!within) process.exitCode = 1;
}

await main();
