/**
 * Builds public/data/v1 and public/audio/syllables from data-raw/.
 *
 *   npm run data:fetch   (once)
 *   npm run data:build
 *   npm run data:validate
 */
import { copyFile, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { strFromU8, unzipSync } from 'fflate';
import { hanvietPinyinKey, hanvietReading, isHanChar, type HanvietData } from '../src/chinese/hanviet';
import type { DataManifest } from '../src/data/manifest';
import type {
  DictRow,
  HskLevelFile,
  HskTrackKey,
  HskWordRecord,
  SentenceRecord,
  SyllableInfo,
} from '../src/data/types';
import { extractClassifiers, parseCedict } from './lib/cedict';
import { ATTRIBUTION_MD } from './lib/datasets';
import { ensureDir, formatBytes, listFiles, sha256, writeGzipJson, writeJson, writeOutput } from './lib/io';
import { DATA_OUT_DIR, outPath, rawPath, ROOT, SYLLABLE_AUDIO_DIR, WORD_AUDIO_DIR } from './lib/paths';
import { pinyinKey, splitSyllable } from './lib/pinyin';
import { hanChars, parseManythingsLine, sentenceLevel } from './lib/sentences';
import { parseUnihanVietnamese } from './lib/unihan';

interface MinForm {
  t: string;
  i: { y: string; n: string };
  m: string[];
  c: string[];
}

interface MinWord {
  s: string;
  r?: string;
  l: string[];
  q: number;
  p: string[];
  f: MinForm[];
}

const TRACKS: Record<string, { track: HskTrackKey; field: keyof HskWordRecord['lv'] }> = {
  o: { track: 'hsk2', field: 'hsk2' },
  n: { track: 'hsk3', field: 'hsk3' },
  t: { track: 'hsk3-newest', field: 'hsk3Newest' },
};

async function readRaw(file: string): Promise<Buffer> {
  try {
    return await readFile(rawPath(file));
  } catch {
    throw new Error(`Missing data-raw/${file}. Run "npm run data:fetch" first.`);
  }
}

/** CEDICT writes ü as "u:"; everything we ship uses "ü". */
function cleanNumbered(pinyin: string): string {
  return pinyin.replace(/u:/g, 'ü').replace(/\s+/g, ' ').trim();
}

/** Case-sensitive key so proper nouns ("Hua2") and common words ("hua2") stay apart. */
function exactPinyinKey(pinyin: string): string {
  return pinyin.replace(/u:|ü/g, 'v').replace(/\s+/g, ' ').trim();
}

function headerLines(text: string): string {
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('#')) break;
    lines.push(line);
  }
  return `${lines.join('\n')}\n`;
}

function mergeUnique(target: string[] | undefined, values: string[]): string[] {
  return [...new Set([...(target ?? []), ...values])];
}

const VARIANT_GLOSS = /^(?:old |archaic |ancient |erroneous |japanese |taiwan |korean )?variant of /i;

/** Entries such as "㝡 最 [zui4] /variant of 最[zui4]/" only point at another form. */
function isVariantOnly(glosses: readonly string[]): boolean {
  return glosses.length > 0 && glosses.every((gloss) => VARIANT_GLOSS.test(gloss));
}

async function main(): Promise<void> {
  const started = Date.now();
  await rm(DATA_OUT_DIR, { recursive: true, force: true });
  await rm(SYLLABLE_AUDIO_DIR, { recursive: true, force: true });
  await rm(WORD_AUDIO_DIR, { recursive: true, force: true });

  // ── Dictionaries: CC-CEDICT joined with CVDICT ─────────────────────────
  const cedictText = gunzipSync(await readRaw('cc-cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz')).toString('utf8');
  const cvdictText = (await readRaw('cvdict/CVDICT.u8')).toString('utf8');
  const cedict = parseCedict(cedictText);
  const cvdict = parseCedict(cvdictText);

  const viExact = new Map<string, string[]>();
  const viLoose = new Map<string, string[]>();
  for (const entry of cvdict) {
    const { glosses } = extractClassifiers(entry.glosses);
    const exactKey = `${entry.trad}\t${entry.simp}\t${exactPinyinKey(entry.pinyin)}`;
    const looseKey = `${entry.simp}\t${pinyinKey(entry.pinyin)}`;
    viExact.set(exactKey, mergeUnique(viExact.get(exactKey), glosses));
    viLoose.set(looseKey, mergeUnique(viLoose.get(looseKey), glosses));
  }
  const lookupVi = (trad: string, simp: string, pinyin: string): string[] =>
    viExact.get(`${trad}\t${simp}\t${exactPinyinKey(pinyin)}`) ?? viLoose.get(`${simp}\t${pinyinKey(pinyin)}`) ?? [];

  const simpChars = new Set<string>();
  const tradChars = new Set<string>();
  const dictRows: DictRow[] = cedict.map((entry) => {
    for (const char of entry.simp) simpChars.add(char);
    for (const char of entry.trad) tradChars.add(char);
    const { glosses, classifiers } = extractClassifiers(entry.glosses);
    return [
      entry.simp,
      entry.trad,
      cleanNumbered(entry.pinyin),
      glosses,
      lookupVi(entry.trad, entry.simp, entry.pinyin),
      classifiers,
    ];
  });
  await writeGzipJson(outPath('dict', 'dict.json.gz'), dictRows);

  // Standard traditional spellings per simplified word + pinyin, used when a form's own spelling is a rare variant.
  const tradBySimp = new Map<string, string[]>();
  for (const entry of cedict) {
    if (isVariantOnly(entry.glosses)) continue;
    const key = `${entry.simp}\t${pinyinKey(entry.pinyin)}`;
    tradBySimp.set(key, mergeUnique(tradBySimp.get(key), [entry.trad]));
  }
  const viCovered = dictRows.filter((row) => row[4].length > 0).length;
  console.log(`dict        ${dictRows.length} entries, ${viCovered} with Vietnamese (${Math.round((viCovered / dictRows.length) * 100)}%)`);

  // ── Hán-Việt: wordlist data + Unihan kVietnamese fallback ─────────────
  const hanvietJs = (await readRaw('hanviet/hanvietData.js')).toString('utf8');
  const hanvietSource = JSON.parse(hanvietJs.slice(hanvietJs.indexOf('{'), hanvietJs.lastIndexOf('}') + 1)) as HanvietData;
  const unihanFiles = unzipSync(new Uint8Array(await readRaw('unihan/Unihan.zip')), {
    filter: (file) => file.name.endsWith('Unihan_Readings.txt'),
  });
  const readingsFile = Object.values(unihanFiles)[0];
  if (!readingsFile) throw new Error('Unihan_Readings.txt not found in Unihan.zip');
  const hanviet: HanvietData = { ...hanvietSource };
  const hasReadings = (entry: Record<string, string[]> | undefined) =>
    entry !== undefined && Object.values(entry).some((readings) => readings.length > 0);
  let fallbackChars = 0;
  for (const [char, readings] of parseUnihanVietnamese(strFromU8(readingsFile))) {
    // Some wordlist entries exist but have only empty reading lists (e.g. 最), so they need the fallback too.
    if (!hasReadings(hanviet[char]) && (simpChars.has(char) || tradChars.has(char))) {
      hanviet[char] = { '*': readings };
      fallbackChars++;
    }
  }

  // Usual full tone of each character + toneless syllable, to read neutral tones (晚上 wan3 shang5 → 上 = 4).
  const toneCounts = new Map<string, number[]>();
  for (const entry of cedict) {
    const chars = [...entry.trad].filter(isHanChar);
    const syllables = entry.pinyin.split(/\s+/).filter((part) => /^[a-zü:]+[1-5]$/i.test(part));
    if (chars.length !== syllables.length) continue;
    chars.forEach((char, index) => {
      const key = hanvietPinyinKey(syllables[index] ?? '');
      const tone = Number(key.slice(-1));
      if (tone < 1 || tone > 4) return;
      const mapKey = `${char}|${key.slice(0, -1)}`;
      const counts = toneCounts.get(mapKey) ?? [0, 0, 0, 0, 0];
      counts[tone] = (counts[tone] ?? 0) + 1;
      toneCounts.set(mapKey, counts);
    });
  }
  const neutralToneHint = (char: string, base: string): number | undefined => {
    const counts = toneCounts.get(`${char}|${base}`);
    if (!counts) return undefined;
    let bestTone: number | undefined;
    let bestCount = 0;
    for (let tone = 1; tone <= 4; tone++) {
      const count = counts[tone] ?? 0;
      if (count > bestCount) {
        bestTone = tone;
        bestCount = count;
      }
    }
    return bestTone;
  };
  await writeJson(outPath('hanviet.json'), hanviet);
  console.log(`hanviet     ${Object.keys(hanvietSource).length} chars + ${fallbackChars} Unihan fallback`);

  // ── HSK word lists ─────────────────────────────────────────────────────
  const hskWords = JSON.parse((await readRaw('complete-hsk-vocabulary/complete.min.json')).toString('utf8')) as MinWord[];
  const buckets = new Map<string, { track: HskTrackKey; level: number; words: HskWordRecord[] }>();
  const levelForSentences = new Map<string, number>();
  const hskCharacters = new Set<string>();

  for (const word of hskWords) {
    const lv: HskWordRecord['lv'] = {};
    const placements: { track: HskTrackKey; level: number }[] = [];
    for (const code of word.l) {
      const info = TRACKS[code.charAt(0)];
      const level = Number(code.slice(1));
      if (!info || !Number.isInteger(level) || level < 1) continue;
      lv[info.field] = Math.min(lv[info.field] ?? Number.POSITIVE_INFINITY, level);
      placements.push({ track: info.track, level });
    }
    if (placements.length === 0) continue;

    // Drop forms that only say "variant of …" (e.g. 㝡 for 最) unless nothing else is left.
    const usefulForms = word.f.filter((form) => !isVariantOnly(form.m));
    const forms = usefulForms.length > 0 ? usefulForms : word.f;

    const record: HskWordRecord = {
      s: word.s,
      ...(word.r ? { r: word.r } : {}),
      q: word.q,
      pos: word.p,
      lv,
      f: forms.map((form) => {
        const pn = cleanNumbered(form.i.n);
        const vi = lookupVi(form.t, word.s, form.i.n);
        const options = { context: vi.join('; '), neutralToneHint };
        // Try the form's spelling, then CC-CEDICT's standard traditional spelling, then the simplified word.
        const spellings = mergeUnique([form.t], [...(tradBySimp.get(`${word.s}\t${pinyinKey(form.i.n)}`) ?? []), word.s]);
        let reading = hanvietReading(hanviet, form.t, pn, options);
        for (const spelling of spellings) {
          if (!reading.best.includes('?')) break;
          reading = hanvietReading(hanviet, spelling, pn, options);
        }
        return {
          t: form.t,
          py: form.i.y,
          pn,
          en: form.m,
          vi,
          cl: form.c,
          hv: reading.best,
          ...(reading.all !== reading.best ? { hva: reading.all } : {}),
        };
      }),
    };
    for (const character of [...word.s].filter(isHanChar)) hskCharacters.add(character);

    for (const { track, level } of placements) {
      const key = `${track}-${level}`;
      const bucket = buckets.get(key) ?? { track, level, words: [] };
      if (!bucket.words.includes(record)) bucket.words.push(record);
      buckets.set(key, bucket);
    }

    const sentenceLevelHint = lv.hsk3 ?? lv.hsk2;
    if (sentenceLevelHint !== undefined) {
      levelForSentences.set(word.s, Math.min(sentenceLevelHint, levelForSentences.get(word.s) ?? Number.POSITIVE_INFINITY));
    }
  }

  for (const bucket of buckets.values()) {
    bucket.words.sort((a, b) => a.q - b.q);
    const file: HskLevelFile = { track: bucket.track, level: bucket.level, words: bucket.words };
    await writeJson(outPath('hsk', `${bucket.track}-${bucket.level}.json`), file);
  }
  const hskCount = new Set(hskWords.map((word) => word.s)).size;
  const hskForms = [...buckets.values()].flatMap((bucket) => bucket.words).flatMap((word) => word.f);
  const ambiguous = hskForms.filter((form) => form.hva).length;
  const unknown = hskForms.filter((form) => form.hv.includes('?')).length;
  console.log(`hsk         ${hskCount} words in ${buckets.size} level files (Hán-Việt: ${ambiguous} ambiguous forms, ${unknown} with unknown chars)`);

  // ── Stroke data (Hanzi Writer / Arphic Public License) ────────────────
  await ensureDir(outPath('hanzi'));
  await ensureDir(outPath('LICENSES'));
  let strokeCharacters = 0;
  for (const character of [...hskCharacters].sort()) {
    try {
      await copyFile(path.join(ROOT, 'node_modules', 'hanzi-writer-data', `${character}.json`), outPath('hanzi', `${character}.json`));
      strokeCharacters++;
    } catch {
      console.warn(`stroke data  missing ${character}`);
    }
  }
  await copyFile(path.join(ROOT, 'node_modules', 'hanzi-writer-data', 'ARPHICPL.TXT'), outPath('LICENSES', 'hanzi-writer-data-Arphic.txt'));
  console.log(`stroke data ${strokeCharacters}/${hskCharacters.size} HSK characters`);

  // ── Syllables and their recordings (audio-cmn) ─────────────────────────
  const syllableSourceDir = rawPath('audio-cmn', '24k-abr', 'syllabs');
  let syllableFiles: string[];
  try {
    syllableFiles = await readdir(syllableSourceDir);
  } catch {
    throw new Error('Missing data-raw/audio-cmn. Run "npm run data:fetch" first.');
  }
  await ensureDir(SYLLABLE_AUDIO_DIR);
  const tonesByKey = new Map<string, Set<number>>();
  let audioCount = 0;
  for (const name of syllableFiles) {
    const match = /^cmn-([a-z]+)([1-5])\.mp3$/.exec(name);
    if (!match?.[1] || !match[2]) continue;
    const [key, tone] = [match[1], Number(match[2])];
    await copyFile(path.join(syllableSourceDir, name), path.join(SYLLABLE_AUDIO_DIR, `${key}${tone}.mp3`));
    const tones = tonesByKey.get(key) ?? new Set<number>();
    tones.add(tone);
    tonesByKey.set(key, tones);
    audioCount++;
  }
  const syllables: SyllableInfo[] = [...tonesByKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, tones]) => {
      const { initial, final } = splitSyllable(key);
      return {
        key,
        display: key.replace(/v/g, 'ü'),
        initial,
        final: final.replace(/v/g, 'ü'),
        tones: [...tones].sort((a, b) => a - b),
      };
    });
  await writeJson(outPath('syllables.json'), syllables);
  console.log(`syllables   ${syllables.length} syllables, ${audioCount} recordings`);

  // ── Word recordings (audio-cmn HSK list, speaker Yue Tan) ──────────────
  const wordSourceDir = rawPath('audio-cmn', '24k-abr', 'hsk');
  let wordFiles: string[] = [];
  try {
    wordFiles = await readdir(wordSourceDir);
  } catch {
    console.warn('word audio  missing data-raw/audio-cmn/24k-abr/hsk; run "npm run data:fetch" to add it');
  }
  await ensureDir(WORD_AUDIO_DIR);
  const wordsWithAudio: string[] = [];
  for (const name of wordFiles) {
    // Skip pattern entries such as "cmn-一_也_.mp3".
    const match = /^cmn-(\p{Script=Han}+)\.mp3$/u.exec(name);
    if (!match?.[1]) continue;
    await copyFile(path.join(wordSourceDir, name), path.join(WORD_AUDIO_DIR, `${match[1]}.mp3`));
    wordsWithAudio.push(match[1]);
  }
  wordsWithAudio.sort();
  await writeJson(outPath('words-audio.json'), wordsWithAudio);
  console.log(`word audio  ${wordsWithAudio.length} recordings`);

  // ── Example sentences (Tatoeba via manythings.org) ─────────────────────
  const tatoeba = unzipSync(new Uint8Array(await readRaw('tatoeba/cmn-eng.zip')));
  const cmnFile = tatoeba['cmn.txt'];
  if (!cmnFile) throw new Error('cmn.txt not found in cmn-eng.zip');
  const traditionalOnly = new Set([...tradChars].filter((char) => isHanChar(char) && !simpChars.has(char)));
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  const tokenLevel = (token: string): number | null => {
    const direct = levelForSentences.get(token);
    if (direct !== undefined) return direct;
    const charLevels = hanChars(token).map((char) => levelForSentences.get(char));
    return charLevels.length > 0 && charLevels.every((level): level is number => level !== undefined)
      ? Math.max(...charLevels)
      : null;
  };

  const sentencesByLevel = new Map<number, SentenceRecord[]>();
  const seen = new Set<string>();
  for (const line of strFromU8(cmnFile).split(/\r?\n/)) {
    const pair = parseManythingsLine(line);
    if (!pair || seen.has(pair.zh)) continue;
    const han = hanChars(pair.zh);
    if (han.length < 2 || han.length > 20 || han.some((char) => traditionalOnly.has(char))) continue;
    const levels = [...segmenter.segment(pair.zh)]
      .filter((segment) => segment.isWordLike && hanChars(segment.segment).length > 0)
      .map((segment) => tokenLevel(segment.segment));
    const level = sentenceLevel(levels, 6, 0.9);
    if (level === null) continue;
    seen.add(pair.zh);
    const list = sentencesByLevel.get(level) ?? [];
    list.push({ zh: pair.zh, en: pair.en, ids: pair.ids });
    sentencesByLevel.set(level, list);
  }
  let sentenceCount = 0;
  for (let level = 1; level <= 6; level++) {
    const list = (sentencesByLevel.get(level) ?? []).sort((a, b) => hanChars(a.zh).length - hanChars(b.zh).length);
    sentenceCount += list.length;
    await writeJson(outPath('sentences', `${level}.json`), list);
  }
  console.log(`sentences   ${sentenceCount} (levels 1–6: ${[1, 2, 3, 4, 5, 6].map((l) => sentencesByLevel.get(l)?.length ?? 0).join(' / ')})`);

  // ── Licences and attribution ───────────────────────────────────────────
  const licenses = (name: string) => outPath('LICENSES', name);
  await ensureDir(outPath('LICENSES'));
  await copyFile(rawPath('complete-hsk-vocabulary', 'LICENSE'), licenses('complete-hsk-vocabulary-MIT.txt'));
  await copyFile(rawPath('hanviet', 'LICENSE'), licenses('hanviet-pinyin-words-MIT.txt'));
  await copyFile(rawPath('unihan', 'LICENSE.txt'), licenses('Unicode-License.txt'));
  await copyFile(rawPath('licenses', 'CC-BY-SA-4.0.txt'), licenses('CC-BY-SA-4.0.txt'));
  await copyFile(rawPath('audio-cmn', 'README.md'), licenses('audio-cmn-README.md'));
  await writeOutput(licenses('CC-CEDICT-header.txt'), headerLines(cedictText));
  await writeOutput(licenses('CVDICT-header.txt'), headerLines(cvdictText));
  const about = tatoeba['_about.txt'];
  if (about) await writeOutput(licenses('Tatoeba-manythings-about.txt'), strFromU8(about));
  await writeOutput(licenses('ATTRIBUTION.md'), ATTRIBUTION_MD);

  // ── Manifest ───────────────────────────────────────────────────────────
  const files = await Promise.all(
    (await listFiles(DATA_OUT_DIR)).map(async (relative) => {
      const content = await readFile(outPath(relative));
      return {
        path: relative,
        bytes: content.length,
        sha256: sha256(content),
        ...(relative.endsWith('.gz') ? { contentSha256: sha256(gunzipSync(content)) } : {}),
      };
    }),
  );
  const manifest: DataManifest = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      hskWords: hskCount,
      dictEntries: dictRows.length,
      hanvietChars: Object.keys(hanviet).length,
      sentences: sentenceCount,
      syllables: syllables.length,
      syllableAudio: audioCount,
      wordAudio: wordsWithAudio.length,
    },
    files,
  };
  await writeJson(outPath('manifest.json'), manifest, true);

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`\nWrote ${files.length} files (${formatBytes(totalBytes)}) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('Next: npm run data:validate');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
