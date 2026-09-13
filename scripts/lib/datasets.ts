/**
 * Every external source the data pack is built from. Keep this list in sync
 * with src/features/settings/sources.ts (the in-app attribution page).
 */
export interface DownloadSpec {
  id: string;
  url: string;
  /** Path inside data-raw/. */
  file: string;
  /** Release-pinned bytes. Mutable upstream URLs are rejected if they drift. */
  sha256: string;
}

export const DOWNLOADS: readonly DownloadSpec[] = [
  {
    id: 'hsk',
    url: 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/HEAD/complete.min.json',
    file: 'complete-hsk-vocabulary/complete.min.json',
    sha256: '52d8e64ba65a6db4a38ea34302c6de5df53cdb5145254b25edcbf93b80676434',
  },
  {
    id: 'hsk-license',
    url: 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/HEAD/LICENSE',
    file: 'complete-hsk-vocabulary/LICENSE',
    sha256: '21094287f6e487f6978cf240c67603e4a0e9f341c6e732558d052feb44210c8f',
  },
  {
    id: 'cedict',
    url: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
    file: 'cc-cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
    sha256: '9e8c364a020db10248c6dcf686d1028e3f552474aa2b819b8199c39ff0949131',
  },
  {
    id: 'cvdict',
    url: 'https://raw.githubusercontent.com/ph0ngp/CVDICT/HEAD/CVDICT.u8',
    file: 'cvdict/CVDICT.u8',
    sha256: '4dde4b204193efa9c192d7f7daeab1bb579c8ccd7c41ed90d1b6caee22ba0948',
  },
  {
    id: 'hanviet',
    url: 'https://raw.githubusercontent.com/ph0ngp/hanviet-pinyin-words/HEAD/src/hanvietData.js',
    file: 'hanviet/hanvietData.js',
    sha256: '2131eff4375fcd5033d0de3cc44babeebebd3c4236090826baf9e2aaef1b85ed',
  },
  {
    id: 'hanviet-license',
    url: 'https://raw.githubusercontent.com/ph0ngp/hanviet-pinyin-words/HEAD/LICENSE',
    file: 'hanviet/LICENSE',
    sha256: '4c88b09e549ab516a6a7acb5b2091fb664dba39dd73e3530199c59783a819d25',
  },
  {
    id: 'unihan',
    url: 'https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip',
    file: 'unihan/Unihan.zip',
    sha256: 'f7a48b2b545acfaa77b2d607ae28747404ce02baefee16396c5d2d7a8ef34b5e',
  },
  {
    id: 'unicode-license',
    url: 'https://www.unicode.org/license.txt',
    file: 'unihan/LICENSE.txt',
    sha256: 'e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96',
  },
  {
    id: 'tatoeba-cmn-eng',
    url: 'https://www.manythings.org/anki/cmn-eng.zip',
    file: 'tatoeba/cmn-eng.zip',
    sha256: 'd606361aa7312dcdfb15ef4fc51cb1e7ed8bc2dc608a7b192626cd36e8403106',
  },
  {
    id: 'cc-by-sa-4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt',
    file: 'licenses/CC-BY-SA-4.0.txt',
    sha256: '28a9529c7d0bb4dc51f4bf5c116a3d16ef247a052f7591466768ddf563fd1cf5',
  },
];

/** Recordings come from a sparse git checkout: syllables (~7.5 MB) and HSK words (~36 MB), 24 kbps. */
export const AUDIO_CMN = {
  repo: 'https://github.com/hugolpz/audio-cmn.git',
  dir: 'audio-cmn',
  sparsePaths: ['24k-abr/syllabs', '24k-abr/hsk'],
  commit: 'ff9ed3d0c631195bd2c06f39450f3264c7124040',
} as const;

export const ATTRIBUTION_MD = `# HanziStep data attribution

| Source | Used for | License | Credit |
|---|---|---|---|
| Complete HSK Vocabulary (github.com/drkameleon/complete-hsk-vocabulary) | HSK 2.0 / 3.0 word lists | MIT | © 2026 Yanis Zafirópulos (Dr.Kameleon) |
| CC-CEDICT (mdbg.net) | Chinese–English dictionary, classifiers | CC BY-SA 4.0 | MDBG; CEDICT © 1997, 1998 Paul Andrew Denisowski |
| CVDICT (github.com/ph0ngp/CVDICT) | Vietnamese meanings | CC BY-SA 4.0 | Phong Phan |
| hanviet-pinyin-words (github.com/ph0ngp/hanviet-pinyin-words) | Sino-Vietnamese readings | MIT | © 2024 Phong Phan |
| Unihan database, kVietnamese (unicode.org) | Fallback Sino-Vietnamese readings | Unicode License v3 | © Unicode, Inc. |
| audio-cmn (github.com/hugolpz/audio-cmn) | Syllable recordings | CC BY-SA | Chen Wang (speaker); curated by hugolpz |
| Tatoeba via manythings.org | Example sentences | CC BY 2.0 FR | Tatoeba contributors (sentence ids kept in sentences/*.json) |

Files that combine CC BY-SA sources (dict/dict.json.gz, hsk/*.json) are shared under CC BY-SA 4.0.
`;
