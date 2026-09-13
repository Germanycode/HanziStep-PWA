/**
 * Spot-checks the generated data pack. Exits with code 1 on any failure.
 *
 *   npm run data:validate
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { readingsFor, type HanvietData } from '../src/chinese/hanviet';
import type { DataManifest } from '../src/data/manifest';
import type { DictRow, HskLevelFile, HskWordRecord, SentenceRecord, SyllableInfo } from '../src/data/types';
import { sha256 } from './lib/io';
import { outPath, SYLLABLE_AUDIO_DIR, WORD_AUDIO_DIR } from './lib/paths';
import { hanChars } from './lib/sentences';

const failures: string[] = [];
let passed = 0;

function check(condition: unknown, message: string): void {
  if (condition) passed++;
  else failures.push(message);
}

async function readJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(outPath(relative), 'utf8')) as T;
}

async function main(): Promise<void> {
  if (!existsSync(outPath('manifest.json'))) {
    throw new Error('public/data/v1/manifest.json is missing. Run "npm run data:build" first.');
  }
  const manifest = await readJson<DataManifest>('manifest.json');

  // Manifest integrity
  for (const file of manifest.files) {
    const full = outPath(file.path);
    if (!existsSync(full)) {
      failures.push(`manifest lists missing file ${file.path}`);
      continue;
    }
    const content = await readFile(full);
    check(content.length === file.bytes && sha256(content) === file.sha256, `checksum mismatch for ${file.path}`);
  }

  // HSK lists
  const hskFiles = manifest.files.filter((file) => file.path.startsWith('hsk/'));
  check(hskFiles.length >= 19, `expected ≥ 19 HSK level files, found ${hskFiles.length}`);
  const allWords: HskWordRecord[] = [];
  for (const file of hskFiles) allWords.push(...(await readJson<HskLevelFile>(file.path)).words);
  const find = (simplified: string) => allWords.find((word) => word.s === simplified);

  const hsk31 = await readJson<HskLevelFile>('hsk/hsk3-1.json');
  check(hsk31.words.length >= 300, `HSK 3.0 level 1 should have ≥ 300 words, has ${hsk31.words.length}`);

  const bank = find('银行');
  check(bank?.f[0]?.pn === 'yin2 hang2', `银行 pinyin should be "yin2 hang2", got "${bank?.f[0]?.pn}"`);
  check(bank?.f[0]?.hv === 'NGÂN HÀNG', `银行 Hán-Việt should be "NGÂN HÀNG", got "${bank?.f[0]?.hv}"`);
  check((bank?.f[0]?.vi.length ?? 0) > 0, '银行 should have a Vietnamese meaning');

  check(bank?.f[0]?.hva === 'NGÂN HÀNG/HẠNG', `银行 should keep its alternatives, got "${bank?.f[0]?.hva}"`);
  check(
    bank?.f[0]?.vi.every((gloss) => !/^(?:CL|LT):/.test(gloss)),
    '银行 Vietnamese glosses should not contain classifier entries',
  );

  // 你好 is not an HSK entry (你 and 好 are listed separately), so check 谢谢 instead.
  const thanks = find('谢谢');
  check(thanks?.f[0]?.pn === 'xie4 xie5', `谢谢 pinyin should be "xie4 xie5", got "${thanks?.f[0]?.pn}"`);
  const study = find('学生');
  check(study?.f[0]?.hv === 'HỌC SINH', `学生 Hán-Việt should be "HỌC SINH", got "${study?.f[0]?.hv}"`);
  const evening = find('晚上');
  check(evening?.f[0]?.hv === 'VÃN THƯỢNG', `晚上 Hán-Việt should be "VÃN THƯỢNG", got "${evening?.f[0]?.hv}"`);
  const most = find('最');
  check(most?.f[0]?.hv && !most.f[0].hv.includes('?'), `最 should have a Hán-Việt reading, got "${most?.f[0]?.hv}"`);

  const withVi = allWords.filter((word) => word.f.some((form) => form.vi.length > 0)).length;
  check(withVi / allWords.length > 0.8, `only ${Math.round((withVi / allWords.length) * 100)}% of HSK words have Vietnamese`);
  const unknownHv = allWords.filter((word) => word.f[0]?.hv.includes('?')).length;
  check(unknownHv / allWords.length < 0.01, `${unknownHv} HSK words have unknown Hán-Việt characters`);

  // Hanzi Writer data must be local for every simplified HSK character.
  const writingChars = new Set(allWords.flatMap((word) => hanChars(word.s)));
  const missingStrokeData = [...writingChars].filter((character) => !existsSync(outPath('hanzi', `${character}.json`)));
  check(missingStrokeData.length === 0, `${missingStrokeData.length} HSK characters have no stroke data`);
  const strokeSample = await readJson<{ strokes?: unknown[]; medians?: unknown[] }>('hanzi/你.json');
  check(Array.isArray(strokeSample.strokes) && strokeSample.strokes.length > 0 && Array.isArray(strokeSample.medians), 'invalid Hanzi Writer data for 你');

  // Dictionary
  const dict = JSON.parse(gunzipSync(await readFile(outPath('dict', 'dict.json.gz'))).toString('utf8')) as DictRow[];
  check(dict.length > 100_000, `dictionary should have > 100k rows, has ${dict.length}`);
  const person = dict.find((row) => row[0] === '人' && row[2] === 'ren2');
  check(person?.[5].includes('个'), '人 should list 个 as a classifier');
  const female = dict.find((row) => row[0] === '女' && row[2] === 'nü3');
  check(female, '女 should be stored with pinyin "nü3"');

  // Hán-Việt data
  const hanviet = await readJson<HanvietData>('hanviet.json');
  check(readingsFor(hanviet, '學', 'xue2').includes('học'), '學 (xue2) should read "học"');
  check(readingsFor(hanviet, '中', 'zhong1').includes('trung'), '中 (zhong1) should read "trung"');

  // Syllables and audio
  const syllables = await readJson<SyllableInfo[]>('syllables.json');
  check(syllables.length >= 380, `expected ≥ 380 syllables, found ${syllables.length}`);
  const ma = syllables.find((syllable) => syllable.key === 'ma');
  check([1, 2, 3, 4].every((tone) => ma?.tones.includes(tone)), '"ma" should have tones 1–4');
  check(syllables.find((syllable) => syllable.key === 'lv')?.display === 'lü', '"lv" should display as "lü"');
  const expectedSyllableAudio = new Set(syllables.flatMap((syllable) => syllable.tones.map((tone) => `${syllable.key}${tone}.mp3`)));
  const actualSyllableAudio = new Set((await readdir(SYLLABLE_AUDIO_DIR)).filter((name) => name.endsWith('.mp3')));
  const missingSyllables = [...expectedSyllableAudio].filter((name) => !actualSyllableAudio.has(name));
  const extraSyllables = [...actualSyllableAudio].filter((name) => !expectedSyllableAudio.has(name));
  check(
    missingSyllables.length === 0 && extraSyllables.length === 0,
    `syllable audio mismatch: ${missingSyllables.length} missing, ${extraSyllables.length} extra`,
  );

  // Sentences
  let sentenceTotal = 0;
  for (let level = 1; level <= 6; level++) {
    const sentences = await readJson<SentenceRecord[]>(`sentences/${level}.json`);
    sentenceTotal += sentences.length;
    check(
      sentences.every((sentence) => hanChars(sentence.zh).length <= 20 && sentence.en && sentence.ids.length > 0),
      `sentences/${level}.json has an invalid row`,
    );
  }
  check(sentenceTotal > 1000, `expected > 1000 sentences, found ${sentenceTotal}`);

  // Word recordings
  const wordAudio = await readJson<string[]>('words-audio.json');
  check(wordAudio.length > 3000, `expected > 3000 word recordings, found ${wordAudio.length}`);
  const expectedWordAudio = new Set(wordAudio.map((hanzi) => `${hanzi}.mp3`));
  const actualWordAudio = new Set((await readdir(WORD_AUDIO_DIR)).filter((name) => name.endsWith('.mp3')));
  const missingWords = [...expectedWordAudio].filter((name) => !actualWordAudio.has(name));
  const extraWords = [...actualWordAudio].filter((name) => !expectedWordAudio.has(name));
  check(
    missingWords.length === 0 && extraWords.length === 0,
    `word audio mismatch: ${missingWords.length} missing, ${extraWords.length} extra`,
  );

  // Licences
  for (const name of ['ATTRIBUTION.md', 'CC-BY-SA-4.0.txt', 'CC-CEDICT-header.txt', 'CVDICT-header.txt', 'hanzi-writer-data-Arphic.txt']) {
    check(existsSync(outPath('LICENSES', name)), `missing LICENSES/${name}`);
  }

  console.log(`${passed} checks passed, ${failures.length} failed.`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
