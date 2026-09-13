import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface HskFile { words: { s: string }[] }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hskDir = join(root, 'public', 'data', 'v1', 'hsk');
const outputDir = join(root, 'public', 'data', 'v1', 'hanzi');
const sourceDir = join(root, 'node_modules', 'hanzi-writer-data');
const chars = new Set<string>();

for (const track of ['hsk2', 'hsk3', 'hsk3-newest']) {
  for (let level = 1; level <= 7; level += 1) {
    try {
      const file = JSON.parse(await readFile(join(hskDir, `${track}-${level}.json`), 'utf8')) as HskFile;
      for (const word of file.words) {
        for (const character of word.s) if (/\p{Script=Han}/u.test(character)) chars.add(character);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

await mkdir(outputDir, { recursive: true });
let copied = 0;
for (const character of chars) {
  try {
    await copyFile(join(sourceDir, `${character}.json`), join(outputDir, `${character}.json`));
    copied += 1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
console.log(`Copied ${copied}/${chars.size} HSK character stroke files.`);
